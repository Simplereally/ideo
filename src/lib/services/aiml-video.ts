import type { VideoGenerationStatus, VideoRequestParams } from "@/lib/types";
import type { ProviderCredentials } from "@/lib/services/provider-credentials";

// ---------------------------------------------------------------------------
// AIML Video API — typed service layer
// P10: All requests route through the internal Next.js API route so the
// AIML API key never leaves the server. See api/aiml/video/generations/route.ts.
// ---------------------------------------------------------------------------

const VIDEO_PROXY = "/api/aiml/video/generations";

// ---------------------------------------------------------------------------
// Response types — what the AIML API actually returns
// ---------------------------------------------------------------------------

/** Raw status strings the AIML API may return. */
type AimlRawStatus =
  | "queued"
  | "waiting"
  | "active"
  | "generating"
  | "completed"
  | "error"
  | "cancelled"
  | "failed";

/** Shape of a successful POST response (generation created). */
interface AimlCreateResponse {
  id: string;
  status?: AimlRawStatus;
  [key: string]: unknown;
}

/** Shape of a GET poll response (generation status + result). */
interface AimlPollResponse {
  id: string;
  status: AimlRawStatus;
  video_url?: string;
  video?: { url?: string };
  error?: string | { message?: string };
  [key: string]: unknown;
}

/** Structured error body the API may return on non-2xx. */
interface AimlErrorBody {
  message?: string;
  error?: string | { message?: string };
  detail?: string;
}

// ---------------------------------------------------------------------------
// Normalized result type — what callers receive
// ---------------------------------------------------------------------------

export interface AimlVideoResult {
  id: string;
  status: VideoGenerationStatus;
  videoUrl: string | null;
  error: string | null;
  /** Pass-through of any extra metadata from the raw response. */
  meta: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Error class for non-2xx AIML responses
// ---------------------------------------------------------------------------

export class AimlApiError extends Error {
  constructor(
    public readonly httpStatus: number,
    public readonly apiMessage: string | null,
    public readonly raw: unknown,
  ) {
    super(
      apiMessage
        ? `AIML API ${httpStatus}: ${apiMessage}`
        : `AIML API returned HTTP ${httpStatus}`,
    );
    this.name = "AimlApiError";
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Map raw AIML statuses into our `VideoGenerationStatus` union.
 *
 * The API uses several in-progress synonyms (`queued`, `waiting`, `active`,
 * `generating`) that we collapse into two buckets.  `failed` is treated as
 * `error` since the generation will not proceed further.
 */
function normalizeStatus(raw: string): VideoGenerationStatus {
  switch (raw) {
    case "queued":
    case "waiting":
      return "queued";
    case "active":
    case "generating":
      return "generating";
    case "completed":
      return "completed";
    case "failed":
    case "error":
      return "error";
    case "cancelled":
      return "cancelled";
    default:
      // Defensive: unknown status treated as generating so polling continues.
      return "generating";
  }
}

/** Extract the video URL from the two shapes the API may use. */
function extractVideoUrl(body: AimlPollResponse): string | null {
  return body.video_url ?? body.video?.url ?? null;
}

/** Extract a human-readable error string. */
function extractError(body: AimlPollResponse): string | null {
  if (!body.error) return null;
  if (typeof body.error === "string") return body.error;
  return body.error.message ?? JSON.stringify(body.error);
}

/** Strip known fields from the response to produce a metadata bag. */
function extractMeta(body: Record<string, unknown>): Record<string, unknown> {
  const { id: _, status: _s, video_url: _v, video: _vi, error: _e, ...rest } = body;
  return rest;
}

/**
 * Read the response body **once** and extract a human-readable error message.
 * Returns both the extracted message and the raw body text so callers can
 * attach the raw payload to structured errors without double-reading.
 */
async function parseErrorBody(res: Response): Promise<{ message: string | null; raw: string | null }> {
  let rawText: string | null = null;
  try {
    rawText = await res.text();
  } catch {
    return { message: null, raw: null };
  }

  try {
    const body = JSON.parse(rawText) as AimlErrorBody;
    if (body.message) return { message: body.message, raw: rawText };
    if (typeof body.error === "string") return { message: body.error, raw: rawText };
    if (body.error && typeof body.error === "object" && body.error.message)
      return { message: body.error.message, raw: rawText };
    if (body.detail) return { message: body.detail, raw: rawText };
    return { message: rawText, raw: rawText };
  } catch {
    // Body wasn't JSON — return the raw text as the message
    return { message: rawText, raw: rawText };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start a new video generation.
 *
 * @returns Normalized result with `id` (the generation id to poll) and initial status.
 * @throws {AimlApiError} on non-2xx responses.
 */
export async function createVideoGeneration(
  payload: { model: string; params: VideoRequestParams; credentials?: ProviderCredentials },
): Promise<AimlVideoResult> {
  const body: Record<string, unknown> = {
    model: payload.model,
    prompt: payload.params.prompt,
  };

  // Map optional params — only include when defined so we don't send nulls.
  if (payload.params.negativePrompt) body.negative_prompt = payload.params.negativePrompt;
  if (payload.params.duration != null) body.duration = payload.params.duration;
  if (payload.params.resolution) body.resolution = payload.params.resolution;
  if (payload.params.aspectRatio) body.aspect_ratio = payload.params.aspectRatio;
  if (payload.params.generateAudio != null) body.generate_audio = payload.params.generateAudio;
  if (payload.params.enhancePrompt != null) body.enhance_prompt = payload.params.enhancePrompt;
  if (payload.params.imageUrl) body.image_url = payload.params.imageUrl;
  if (payload.params.audioUrl) body.audio_url = payload.params.audioUrl;
  if (payload.params.shotType) body.shot_type = payload.params.shotType;
  if (payload.params.seed != null) body.seed = payload.params.seed;

  // Forward BYOK credentials when present (server falls back to env vars if absent).
  if (payload.credentials) body.credentials = payload.credentials;

  const res = await fetch(VIDEO_PROXY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const { message, raw } = await parseErrorBody(res);
    throw new AimlApiError(res.status, message, raw);
  }

  const data = (await res.json()) as AimlCreateResponse;

  return {
    id: data.id,
    status: normalizeStatus(data.status ?? "queued"),
    videoUrl: null,
    error: null,
    meta: extractMeta(data as unknown as Record<string, unknown>),
  };
}

/**
 * Poll the status of an existing video generation.
 *
 * @param generationId — the AIML generation id to poll.
 * @param apiKey       — optional BYOK API key forwarded as a query param so
 *                       the server proxy can authenticate when no env key is set.
 * @returns Normalized result with current status, video URL if completed, error if failed.
 * @throws {AimlApiError} on non-2xx responses.
 */
export async function getVideoGeneration(
  generationId: string,
  apiKey?: string,
): Promise<AimlVideoResult> {
  const params = new URLSearchParams({ generation_id: generationId });
  const url = `${VIDEO_PROXY}?${params.toString()}`;

  const headers: Record<string, string> = {};
  if (apiKey) headers["x-api-key"] = apiKey;

  const res = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!res.ok) {
    const { message, raw } = await parseErrorBody(res);
    throw new AimlApiError(res.status, message, raw);
  }

  const data = (await res.json()) as AimlPollResponse;

  return {
    id: data.id,
    status: normalizeStatus(data.status),
    videoUrl: extractVideoUrl(data),
    error: extractError(data),
    meta: extractMeta(data as unknown as Record<string, unknown>),
  };
}
