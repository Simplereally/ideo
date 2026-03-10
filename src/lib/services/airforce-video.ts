import type { ProviderCredentials } from "@/lib/services/provider-credentials";
import type {
  VideoGenerationCreateInput,
  VideoGenerationResult,
} from "@/lib/services/video-generation-types";

const VIDEO_PROXY = "/api/airforce/video/generations";

interface VideoErrorBody {
  message?: string;
  error?: string | { message?: string };
  detail?: string;
  upstreamStatus?: number;
  upstreamBody?: unknown;
  sentRequestBody?: unknown;
}

/**
 * Structured diagnostics from route error responses.
 * Useful for debugging contract mismatches and upstream failures.
 */
export interface AirforceVideoDiagnostics {
  upstreamStatus?: number;
  upstreamBody?: unknown;
  sentRequestBody?: unknown;
}

/**
 * Error thrown when Airforce video generation fails.
 * Includes structured diagnostics for developers while keeping user-facing message concise.
 */
export class AirforceVideoError extends Error {
  readonly diagnostics: AirforceVideoDiagnostics;

  constructor(message: string, diagnostics: AirforceVideoDiagnostics = {}) {
    super(message);
    this.name = "AirforceVideoError";
    this.diagnostics = diagnostics;
  }
}

interface ParsedError {
  message: string | null;
  diagnostics: AirforceVideoDiagnostics;
}

async function parseErrorBody(res: Response): Promise<ParsedError> {
  const diagnostics: AirforceVideoDiagnostics = {};

  try {
    const rawText = await res.text();
    try {
      const body = JSON.parse(rawText) as VideoErrorBody;

      // Extract diagnostics from route error response
      if (typeof body.upstreamStatus === "number") {
        diagnostics.upstreamStatus = body.upstreamStatus;
      }
      if (body.upstreamBody !== undefined) {
        diagnostics.upstreamBody = body.upstreamBody;
      }
      if (body.sentRequestBody !== undefined) {
        diagnostics.sentRequestBody = body.sentRequestBody;
      }

      // Extract human-readable message
      let message: string | null = null;
      if (body.message) message = body.message;
      else if (typeof body.error === "string") message = body.error;
      else if (body.error && typeof body.error === "object" && body.error.message) {
        message = body.error.message;
      } else if (body.detail) message = body.detail;
      else message = rawText || null;

      return { message, diagnostics };
    } catch {
      return { message: rawText || null, diagnostics };
    }
  } catch {
    return { message: null, diagnostics };
  }
}

function injectCredentials(
  body: Record<string, unknown>,
  credentials?: ProviderCredentials,
): Record<string, unknown> {
  if (!credentials) return body;
  return { ...body, credentials };
}

export async function createAirforceVideoGeneration(
  payload: Pick<VideoGenerationCreateInput, "model" | "params" | "credentials">,
): Promise<VideoGenerationResult> {
  const referenceImageUrls = payload.params.imageUrl ? [payload.params.imageUrl] : undefined;
  const body = injectCredentials(
    {
      model: payload.model,
      prompt: payload.params.prompt,
      negativePrompt: payload.params.negativePrompt,
      duration: payload.params.duration,
      resolution: payload.params.resolution,
      aspectRatio: payload.params.aspectRatio,
      generateAudio: payload.params.generateAudio,
      imageUrl:
        payload.model === "grok-imagine-video" ? undefined : payload.params.imageUrl,
      image_urls:
        payload.model === "grok-imagine-video" ? referenceImageUrls : undefined,
      seed: payload.params.seed,
    },
    payload.credentials,
  );

  const res = await fetch(VIDEO_PROXY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const { message, diagnostics } = await parseErrorBody(res);
    throw new AirforceVideoError(
      message ?? `Airforce video API returned HTTP ${res.status}`,
      diagnostics,
    );
  }

  return (await res.json()) as VideoGenerationResult;
}
