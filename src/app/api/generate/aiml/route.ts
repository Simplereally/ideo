import { NextResponse } from "next/server";
import { uploadBase64ToR2 } from "@/lib/server/upload";
import { isAllowedModel } from "@/lib/server/model-allowlist";
import { generationLimiter, getClientIp, rateLimitResponse } from "@/lib/server/rate-limit";
import { resolveApiKey } from "@/lib/server/resolve-keys";
import { extractApiKey } from "@/lib/server/extract-credentials";
import type { ImageGenerationRequest, ImageGenerationResponse } from "@/lib/types/generation";

// ---------------------------------------------------------------------------
// POST /api/generate/aiml
// Server-side proxy for AI/ML API image generation.
// Accepts an optional client-provided `apiKey`; falls back to env var.
// ---------------------------------------------------------------------------

const UPSTREAM = "https://api.aimlapi.com/v1/images/generations";

/** Models that accept the fal-style `image_size` enum. */
const IMAGE_SIZE_MODELS = new Set([
  "blackforestlabs/flux-2-pro",
  "blackforestlabs/flux-2",
  "bytedance/seedream-v4-text-to-image",
  "alibaba/wan2.2-t2i-plus",
  "alibaba/wan2.2-t2i-flash",
  "alibaba/wan2.5-t2i-preview",
  "alibaba/wan-2-6-image",
  "alibaba/z-image-turbo",
]);

/**
 * Per-model upper bounds for `num_inference_steps`.
 * If the client sends a value above the limit, we clamp it server-side so the
 * upstream API never receives an out-of-range value.
 */
const MAX_INFERENCE_STEPS: Record<string, number> = {
  "alibaba/z-image-turbo": 8,
};

/** Map canonical aspect ratio to AIML's image_size enum. */
function mapImageSize(ar: string): string {
  switch (ar) {
    case "16:9":
      return "landscape_16_9";
    case "9:16":
      return "portrait_16_9";
    case "4:3":
      return "landscape_4_3";
    case "3:4":
      return "portrait_4_3";
    default:
      return "square_hd";
  }
}

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
    process.env.AIML_API_KEY,
    "AI/ML",
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

  // Strip "aiml:" prefix if present.
  const apiModelId = body.model.includes(":")
    ? body.model.split(":").slice(1).join(":")
    : body.model;

  // --- Model allowlist validation ---
  if (!isAllowedModel("aiml", apiModelId)) {
    return NextResponse.json(
      { error: `Invalid model: ${apiModelId}` },
      { status: 400 },
    );
  }

  const aimlBody: Record<string, unknown> = {
    model: apiModelId,
    prompt: body.prompt,
  };

  if (IMAGE_SIZE_MODELS.has(apiModelId)) {
    aimlBody.image_size = mapImageSize(body.aspectRatio);
  }
  if (body.seed != null) {
    aimlBody.seed = body.seed;
  }
  if (body.negativePrompt) {
    aimlBody.negative_prompt = body.negativePrompt;
  }
  if (body.enhancePrompt != null) {
    aimlBody.enhance_prompt = body.enhancePrompt;
  }
  // Z Image Turbo: always hardcode 8 steps, ignoring any client value
  if (apiModelId === "alibaba/z-image-turbo") {
    aimlBody.num_inference_steps = 8;
  } else if (body.numInferenceSteps != null) {
    const max = MAX_INFERENCE_STEPS[apiModelId];
    aimlBody.num_inference_steps = max
      ? Math.min(body.numInferenceSteps, max)
      : body.numInferenceSteps;
  }
  // Safety checker is hard-disabled for all AIML models.
  aimlBody.enable_safety_checker = false;

  try {
    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(aimlBody),
    });

    if (!upstream.ok) {
      const errData = await upstream.json().catch(() => ({}));
      const errMsg =
        (errData as { error?: { message?: string } | string }).error
          ? typeof (errData as { error: unknown }).error === "string"
            ? String((errData as { error: string }).error)
            : String(
                ((errData as { error: { message?: string } }).error as { message?: string })
                  ?.message ?? `AI/ML API returned ${upstream.status}`,
              )
          : `AI/ML API returned ${upstream.status}`;
      return NextResponse.json({ error: errMsg }, { status: upstream.status });
    }

    const data = (await upstream.json()) as {
      data?: { url?: string; b64_json?: string }[];
    };
    const first = data.data?.[0];

    if (!first) {
      return NextResponse.json(
        { error: "No image generated by AI/ML API" },
        { status: 502 },
      );
    }

    let imageUrl: string;
    if (first.url) {
      imageUrl = first.url;
    } else if (first.b64_json) {
      // Upload base64 to R2, with data-URL fallback.
      imageUrl = await uploadBase64ToR2(first.b64_json, "image/png", "png");
    } else {
      return NextResponse.json(
        { error: "AI/ML API response contained no image URL or base64 data" },
        { status: 502 },
      );
    }

    const result: ImageGenerationResponse = { imageUrl };
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "AIML upstream request failed";
    console.error("[api/generate/aiml] error:", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
