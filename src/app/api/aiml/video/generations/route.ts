import { NextResponse } from "next/server";
import { isAllowedModel } from "@/lib/server/model-allowlist";
import { generationLimiter, getClientIp, rateLimitResponse } from "@/lib/server/rate-limit";
import { resolveApiKey } from "@/lib/server/resolve-keys";
import { extractApiKey } from "@/lib/server/extract-credentials";

// ---------------------------------------------------------------------------
// Server-side proxy for AIML video generation API.
// Accepts an optional client-provided `apiKey`; falls back to env var.
// ---------------------------------------------------------------------------

const UPSTREAM = "https://api.aimlapi.com/v2/video/generations";

/** Allowlisted body fields forwarded to the upstream API. */
const ALLOWED_FIELDS = new Set([
  "model",
  "prompt",
  "negative_prompt",
  "duration",
  "resolution",
  "aspect_ratio",
  "generate_audio",
  "enhance_prompt",
  "image_url",
  "audio_url",
  "shot_type",
  "seed",
]);

/**
 * POST — Create a new video generation.
 * Validates `model` + `prompt`, allowlists body fields, then forwards to upstream.
 */
export async function POST(request: Request) {
  // --- Rate limiting ---
  const rl = generationLimiter(getClientIp(request));
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: Record<string, unknown>;
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

  if (!body.model || typeof body.model !== "string" || !body.prompt || typeof body.prompt !== "string") {
    return NextResponse.json(
      { error: "`model` and `prompt` are required" },
      { status: 400 },
    );
  }

  // --- Model allowlist validation ---
  if (!isAllowedModel("aiml", body.model)) {
    return NextResponse.json(
      { error: `Invalid model: ${body.model}` },
      { status: 400 },
    );
  }

  // Construct upstream payload from allowlisted fields only — never forward
  // arbitrary client-supplied keys to the upstream API.
  const upstreamBody: Record<string, unknown> = {};
  for (const key of ALLOWED_FIELDS) {
    if (key in body && body[key] !== undefined) {
      upstreamBody[key] = body[key];
    }
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let upstream: Response;
    try {
      upstream = await fetch(UPSTREAM, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(upstreamBody),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    // Preserve upstream status and body as-is so the client service layer
    // can apply its existing error-parsing logic unchanged.
    const data = await upstream.text();
    return new NextResponse(data, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return NextResponse.json(
        { error: "AIML upstream request timed out" },
        { status: 504 },
      );
    }
    console.error("[api/aiml/video/generations] POST upstream error:", err);
    return NextResponse.json(
      { error: "Failed to reach AIML upstream" },
      { status: 500 },
    );
  }
}

/**
 * GET — Poll an existing video generation by `generation_id` query param.
 * Accepts an optional `apiKey` query param for BYOK; falls back to env var.
 */
export async function GET(request: Request) {
  // --- Rate limiting ---
  const rl = generationLimiter(getClientIp(request));
  if (!rl.allowed) return rateLimitResponse(rl);

  const { searchParams } = new URL(request.url);

  // --- Resolve API key: header > query param (legacy) > env ---
  const headerKey = request.headers.get("x-api-key");
  const keyResult = resolveApiKey(
    headerKey ?? searchParams.get("apiKey"),
    process.env.AIML_API_KEY,
    "AI/ML",
  );
  if (!keyResult.ok) {
    return NextResponse.json({ error: keyResult.error }, { status: 401 });
  }
  const apiKey = keyResult.value;

  const generationId = searchParams.get("generation_id");

  if (!generationId) {
    return NextResponse.json(
      { error: "`generation_id` query parameter is required" },
      { status: 400 },
    );
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let upstream: Response;
    try {
      upstream = await fetch(
        `${UPSTREAM}?generation_id=${encodeURIComponent(generationId)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        },
      );
    } finally {
      clearTimeout(timeout);
    }

    const data = await upstream.text();
    return new NextResponse(data, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return NextResponse.json(
        { error: "AIML upstream polling request timed out" },
        { status: 504 },
      );
    }
    console.error("[api/aiml/video/generations] GET upstream error:", err);
    return NextResponse.json(
      { error: "Failed to reach AIML upstream" },
      { status: 500 },
    );
  }
}
