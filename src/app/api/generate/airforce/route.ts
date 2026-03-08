import { NextResponse } from "next/server";
import { uploadBase64ToR2 } from "@/lib/server/upload";
import { isAllowedModel } from "@/lib/server/model-allowlist";
import { generationLimiter, getClientIp, rateLimitResponse } from "@/lib/server/rate-limit";
import { resolveApiKey } from "@/lib/server/resolve-keys";
import { extractApiKey } from "@/lib/server/extract-credentials";
import { MODELS } from "@/lib/types";
import type { ImageGenerationRequest, ImageGenerationResponse } from "@/lib/types/generation";
import { validateImageGenerationResponse } from "@/lib/types/generation";

// ---------------------------------------------------------------------------
// POST /api/generate/airforce
// Server-side proxy for the Airforce API (OpenAI-compatible image generation).
// Accepts an optional client-provided `apiKey`; falls back to env var.
// ---------------------------------------------------------------------------

const UPSTREAM = "https://api.airforce/v1/images/generations";

// ---------------------------------------------------------------------------
// Capability sets derived from the shared model catalog.
// Keyed by apiModelId (the `value` field, i.e. the prefix-stripped model id).
// Computed once at module load — MODELS is a static constant.
// ---------------------------------------------------------------------------

const airforceModels = MODELS.filter((m) => m.provider === "airforce");

/** Models that accept a `seed` parameter. */
const SEED_MODELS = new Set(
  airforceModels.filter((m) => m.capabilities.seed).map((m) => m.value),
);

/** Models that accept a `negativePrompt` parameter. */
const NEGATIVE_PROMPT_MODELS = new Set(
  airforceModels.filter((m) => m.capabilities.negativePrompt).map((m) => m.value),
);

// ---------------------------------------------------------------------------
// Aspect ratio → pixel size mapping
// Airforce is OpenAI-compatible and only accepts standard OpenAI sizes:
// "1024x1024", "1024x1792", "1792x1024".
// ---------------------------------------------------------------------------

function mapSize(ar: string): string {
  switch (ar) {
    case "16:9":
      return "1792x1024";
    case "9:16":
      return "1024x1792";
    case "4:3":
      return "1792x1024"; // closest wide format
    case "3:4":
      return "1024x1792"; // closest tall format
    default:
      return "1024x1024";
  }
}

// ---------------------------------------------------------------------------
// Batch support — only models where this app intentionally enables multi-image
// requests. Airforce does not publish a clean public spec for every model, so
// models not listed here stay on a single-image request.
// ---------------------------------------------------------------------------

const BATCH_MODELS: Partial<Record<string, number>> = {
  "grok-imagine": 10,
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

  const modelEntry = airforceModels.find((model) => model.value === apiModelId);
  if (!modelEntry || modelEntry.kind !== "image") {
    return NextResponse.json(
      { error: `Model ${apiModelId} must be generated through the video pipeline.` },
      { status: 400 },
    );
  }

  // --- Build upstream request body ---
  const airforceBody: Record<string, unknown> = {
    model: apiModelId,
    prompt: body.prompt,
    n: 1,
    response_format: "url",
    size: mapSize(body.aspectRatio),
  };

  const batchMax = BATCH_MODELS[apiModelId];
  if (batchMax) {
    airforceBody.n = resolveImageCount(body.numberOfImages, batchMax);
  }

  if (SEED_MODELS.has(apiModelId) && body.seed != null) {
    airforceBody.seed = body.seed;
  }

  if (NEGATIVE_PROMPT_MODELS.has(apiModelId) && body.negativePrompt) {
    airforceBody.negativePrompt = body.negativePrompt;
  }

  try {
    console.log("[api/generate/airforce] upstream request body:", JSON.stringify(airforceBody));

    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(airforceBody),
    });

    console.log("[api/generate/airforce] upstream response status:", upstream.status);

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => "");
      console.error("[api/generate/airforce] upstream error body:", errText);

      let errMsg = `Airforce API returned ${upstream.status}`;
      try {
        const errData = JSON.parse(errText) as { error?: { message?: string } | string };
        if (errData.error) {
          errMsg =
            typeof errData.error === "string"
              ? errData.error
              : errData.error.message ?? errMsg;
        }
      } catch {
        // errText was not valid JSON — use status-based message
        if (errText) errMsg = errText.slice(0, 200);
      }
      return NextResponse.json({ error: errMsg }, { status: upstream.status });
    }

    // Read raw text first so we can log even if JSON parsing fails
    const rawText = await upstream.text();
    console.log(
      "[api/generate/airforce] raw response body (first 500 chars):",
      rawText.slice(0, 500),
    );

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(rawText);
    } catch {
      console.error("[api/generate/airforce] failed to parse JSON response");
      return NextResponse.json(
        { error: "Airforce API returned non-JSON response" },
        { status: 502 },
      );
    }

    console.log(
      "[api/generate/airforce] parsed response keys:",
      Object.keys(data),
    );

    // Extract image items — handle both `data` array (OpenAI standard)
    // and a top-level `images` or `url` field (non-standard fallbacks).
    type ImageItem = { url?: string; b64_json?: string };
    let items: ImageItem[] = [];

    if (Array.isArray(data.data) && data.data.length > 0) {
      items = data.data as ImageItem[];
    } else if (Array.isArray(data.images) && (data.images as unknown[]).length > 0) {
      // Some providers nest under `images` instead of `data`
      items = data.images as ImageItem[];
    } else if (typeof data.url === "string" && data.url) {
      // Single-image shorthand response
      items = [{ url: data.url as string }];
    } else if (typeof data.b64_json === "string" && data.b64_json) {
      items = [{ b64_json: data.b64_json as string }];
    }

    console.log("[api/generate/airforce] extracted items count:", items.length);

    if (items.length === 0) {
      console.warn(
        "[api/generate/airforce] empty data — full response:",
        rawText.slice(0, 1000),
      );
      return NextResponse.json(
        { error: "No output generated by Airforce API" },
        { status: 502 },
      );
    }

    const results = await Promise.all(
      items.map(async (item) => {
        if (item.url) {
          return { imageUrl: item.url };
        }
        if (item.b64_json) {
          return {
            imageUrl: await uploadBase64ToR2(item.b64_json, "image/png", "png"),
          };
        }
        return null;
      }),
    );

    const resolved = results.filter(
      (r): r is { imageUrl: string } => r !== null,
    );

    if (resolved.length === 0) {
      console.warn(
        "[api/generate/airforce] items existed but all resolved to null — items[0] keys:",
        items[0] ? Object.keys(items[0]) : "N/A",
      );
      return NextResponse.json(
        { error: "No output generated by Airforce API" },
        { status: 502 },
      );
    }

    const result: ImageGenerationResponse = {
      imageUrl: resolved[0].imageUrl,
      images: resolved,
    };
    validateImageGenerationResponse(result, "airforce");
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Airforce upstream request failed";
    console.error("[api/generate/airforce] error:", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
