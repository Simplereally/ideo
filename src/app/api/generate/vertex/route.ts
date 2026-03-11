import { NextResponse } from "next/server";
import { uploadBase64ToR2 } from "@/lib/server/upload";
import { isAllowedModel } from "@/lib/server/model-allowlist";
import { generationLimiter, getClientIp, rateLimitResponse } from "@/lib/server/rate-limit";
import { resolveVertexCredentials } from "@/lib/server/resolve-keys";
import { extractVertexCredentials } from "@/lib/server/extract-credentials";
import {
  logGenerationRequest,
  logGenerationResponse,
  logGenerationTextResponse,
} from "@/lib/server/generation-debug";
import type {
  ImageGenerationRequest,
  ImageGenerationResponse,
} from "@/lib/types/generation";
import { validateImageGenerationResponse } from "@/lib/types/generation";
import { MODELS } from "@/lib/types";

function resolveImageCount(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.min(4, Math.max(1, Math.floor(value)));
}

// ---------------------------------------------------------------------------
// POST /api/generate/vertex
// Server-side proxy for Vertex AI Imagen image generation.
// Accepts optional client-provided vertex credentials; falls back to env vars.
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // --- Rate limiting ---
  const rl = generationLimiter(getClientIp(request));
  if (!rl.allowed) return rateLimitResponse(rl);

  // -- Parse & validate request body --
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return NextResponse.json(
      { error: "JSON body must be an object" },
      { status: 400 },
    );
  }

  const body = parsed as ImageGenerationRequest & {
    vertex?: { accessToken?: string; projectId?: string; location?: string };
    credentials?: { accessToken?: string; projectId?: string; location?: string };
  };

  // --- Resolve Vertex credentials: credentials > body.vertex > env ---
  const clientVertex = extractVertexCredentials(body);
  const credResult = resolveVertexCredentials(clientVertex, {
    accessToken: process.env.VERTEX_ACCESS_TOKEN,
    projectId: process.env.VERTEX_PROJECT_ID,
    location: process.env.VERTEX_LOCATION,
  });
  if (!credResult.ok) {
    return NextResponse.json({ error: credResult.error }, { status: 401 });
  }
  const { accessToken, projectId, location } = credResult.value;

  if (
    typeof body.prompt !== "string" || !body.prompt.trim() ||
    typeof body.model !== "string" || !body.model.trim() ||
    typeof body.aspectRatio !== "string" || !body.aspectRatio.trim()
  ) {
    return NextResponse.json(
      { error: "`prompt`, `model`, and `aspectRatio` are required" },
      { status: 400 },
    );
  }

  // Strip "vertex:" prefix if present.
  const apiModelId = body.model.includes(":")
    ? body.model.split(":").slice(1).join(":")
    : body.model;

  // --- Model allowlist validation ---
  if (!isAllowedModel("vertex", apiModelId)) {
    return NextResponse.json(
      { error: `Invalid model: ${apiModelId}` },
      { status: 400 },
    );
  }

  // -- Build Vertex predict payload --
  // Look up the model's declared capabilities from the shared catalog
  // so we only forward controls the model actually supports.
  const modelEntry = MODELS.find((m) => m.value === apiModelId && m.provider === "vertex");
  const caps = modelEntry?.capabilities;

  const parameters: Record<string, unknown> = {
    sampleCount: resolveImageCount(body.numberOfImages),
    aspectRatio: body.aspectRatio,
    addWatermark: false,
  };

  if (caps?.seed && body.seed != null) {
    parameters.seed = body.seed;
  }
  if (caps?.negativePrompt && body.negativePrompt) {
    parameters.negativePrompt = body.negativePrompt;
  }
  if (caps?.enhancePrompt && body.enhancePrompt != null) {
    parameters.enhancePrompt = body.enhancePrompt;
  }
  if (caps?.personGeneration && body.personGeneration) {
    parameters.personGeneration = body.personGeneration;
  }

  try {
    const upstreamUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${apiModelId}:predict`;
    const vertexRequest = {
      url: upstreamUrl,
      instances: [{ prompt: body.prompt }],
      parameters,
    };
    logGenerationRequest("POST api/generate/vertex", vertexRequest);

    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        instances: [{ prompt: body.prompt }],
        parameters,
      }),
    });

    const rawText = await upstream.text();
    logGenerationTextResponse("POST api/generate/vertex", upstream.status, rawText);
    const data = rawText ? JSON.parse(rawText) : {};
    logGenerationResponse("POST api/generate/vertex", data);

    if (!upstream.ok) {
      // Preserve meaningful upstream error messages.
      const errMsg =
        data?.error?.message ??
        `Vertex AI returned ${upstream.status}`;
      return NextResponse.json(
        { error: errMsg },
        { status: upstream.status },
      );
    }

    const predictions = (data.predictions ?? []) as Array<{
      bytesBase64Encoded?: string;
      mimeType?: string;
    }>;

    const images = await Promise.all(
      predictions
        .filter((prediction) => Boolean(prediction.bytesBase64Encoded))
        .map(async (prediction) => {
          const mimeType = prediction.mimeType ?? "image/png";
          const ext = mimeType === "image/jpeg" ? "jpg" : "png";

          return {
            imageUrl: await uploadBase64ToR2(
              prediction.bytesBase64Encoded!,
              mimeType,
              ext,
            ),
          };
        }),
    );

    if (images.length === 0) {
      return NextResponse.json(
        { error: "No image generated by Vertex AI" },
        { status: 502 },
      );
    }

    const result: ImageGenerationResponse = {
      imageUrl: images[0].imageUrl,
      images,
    };
    validateImageGenerationResponse(result, "vertex");
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Vertex upstream request failed";
    console.error("[api/generate/vertex] error:", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
