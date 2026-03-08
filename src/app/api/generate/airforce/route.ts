import { NextResponse } from "next/server";
import { uploadBase64ToR2 } from "@/lib/server/upload";
import { isAllowedModel } from "@/lib/server/model-allowlist";
import { generationLimiter, getClientIp, rateLimitResponse } from "@/lib/server/rate-limit";
import { resolveApiKey } from "@/lib/server/resolve-keys";
import { extractApiKey } from "@/lib/server/extract-credentials";
import type { ImageGenerationRequest, ImageGenerationResponse } from "@/lib/types/generation";

// ---------------------------------------------------------------------------
// POST /api/generate/airforce
// Server-side proxy for the Airforce API (OpenAI-compatible image generation).
// Accepts an optional client-provided `apiKey`; falls back to env var.
// ---------------------------------------------------------------------------

const UPSTREAM = "https://api.airforce/v1/images/generations";

/** Models that produce video instead of images. */
const VIDEO_MODELS = new Set(["grok-imagine-video"]);

// ---------------------------------------------------------------------------
// Aspect ratio → pixel size mapping
// Airforce uses explicit pixel dimensions (WxH strings).
// ---------------------------------------------------------------------------

function mapSize(ar: string): string {
  switch (ar) {
    case "16:9":
      return "1536x1024";
    case "9:16":
      return "1024x1536";
    case "4:3":
      return "1344x1024";
    case "3:4":
      return "1024x1344";
    default:
      return "1024x1024";
  }
}

// ---------------------------------------------------------------------------
// Batch support — only models known to honour the OpenAI `n` parameter.
// Models not listed here always generate a single image per request.
// ---------------------------------------------------------------------------

const BATCH_MODELS: Partial<Record<string, number>> = {
  "grok-imagine": 4,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveImageCount(value: number | undefined, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.min(max, Math.max(1, Math.floor(value)));
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // --- Rate limiting ---
  const rl = generationLimiter(getClientIp(request));
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: ImageGenerationRequest & { apiKey?: string; credentials?: { apiKey?: string } };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  // --- Resolve API key: credentials.apiKey > body.apiKey > env ---
  const clientKey = extractApiKey(body);
  const keyResult = resolveApiKey(
    clientKey,
    process.env.AIRFORCE_API_KEY,
    "Airforce",
  );
  if (!keyResult.ok) {
    return NextResponse.json({ error: keyResult.error }, { status: 401 });
  }
  const apiKey = keyResult.value;

  if (!body.prompt || !body.model || !body.aspectRatio) {
    return NextResponse.json(
      { error: "`prompt`, `model`, and `aspectRatio` are required" },
      { status: 400 },
    );
  }

  // Strip "airforce:" prefix if present.
  const apiModelId = body.model.includes(":")
    ? body.model.split(":").slice(1).join(":")
    : body.model;

  // --- Model allowlist validation ---
  if (!isAllowedModel("airforce", apiModelId)) {
    return NextResponse.json(
      { error: `Invalid model: ${apiModelId}` },
      { status: 400 },
    );
  }

  // --- Build upstream request body ---
  const airforceBody: Record<string, unknown> = {
    model: apiModelId,
    prompt: body.prompt,
    size: mapSize(body.aspectRatio),
  };

  const batchMax = BATCH_MODELS[apiModelId];
  if (batchMax) {
    airforceBody.n = resolveImageCount(body.numberOfImages, batchMax);
  }

  const isVideo = VIDEO_MODELS.has(apiModelId);

  try {
    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(airforceBody),
    });

    if (!upstream.ok) {
      const errData = await upstream.json().catch(() => ({}));
      const errMsg =
        (errData as { error?: { message?: string } | string }).error
          ? typeof (errData as { error: unknown }).error === "string"
            ? String((errData as { error: string }).error)
            : String(
                ((errData as { error: { message?: string } }).error as { message?: string })
                  ?.message ?? `Airforce API returned ${upstream.status}`,
              )
          : `Airforce API returned ${upstream.status}`;
      return NextResponse.json({ error: errMsg }, { status: upstream.status });
    }

    const data = (await upstream.json()) as {
      data?: { url?: string; b64_json?: string }[];
    };

    const results = await Promise.all(
      (data.data ?? []).map(async (item) => {
        if (item.url) {
          return { imageUrl: item.url };
        }
        if (item.b64_json) {
          const contentType = isVideo ? "video/mp4" : "image/png";
          const ext = isVideo ? "mp4" : "png";
          return {
            imageUrl: await uploadBase64ToR2(item.b64_json, contentType, ext),
          };
        }
        return null;
      }),
    );

    const resolved = results.filter(
      (r): r is { imageUrl: string } => r !== null,
    );

    if (resolved.length === 0) {
      return NextResponse.json(
        { error: "No output generated by Airforce API" },
        { status: 502 },
      );
    }

    const result: ImageGenerationResponse = {
      imageUrl: resolved[0].imageUrl,
      images: resolved,
    };
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Airforce upstream request failed";
    console.error("[api/generate/airforce] error:", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
