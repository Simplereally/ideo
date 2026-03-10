import type { ProviderCredentials } from "@/lib/services/provider-credentials";
import type {
  VideoGenerationCreateInput,
  VideoGenerationResult,
} from "@/lib/services/video-generation-types";

const VIDEO_PROXY = "/api/airforce/video/generations";

interface VideoErrorBody {
  message?: string;
  error?: string | { message?: string; detail?: string; details?: unknown };
  detail?: string;
  details?: unknown;
  upstreamStatus?: number;
  upstreamBody?: unknown;
  sentRequestBody?: unknown;
}

export interface AirforceVideoDiagnostics {
  upstreamStatus?: number;
  upstreamBody?: unknown;
  sentRequestBody?: unknown;
}

export class AirforceVideoError extends Error {
  constructor(
    public readonly httpStatus: number,
    message: string,
    public readonly diagnostics: AirforceVideoDiagnostics = {},
    public readonly raw: unknown = null,
  ) {
    super(message);
    this.name = "AirforceVideoError";
  }
}

interface ParsedError {
  message: string | null;
  diagnostics: AirforceVideoDiagnostics;
  raw: unknown;
}

async function parseErrorBody(res: Response): Promise<ParsedError> {
  const diagnostics: AirforceVideoDiagnostics = {};

  try {
    const rawText = await res.text();
    try {
      const body = JSON.parse(rawText) as VideoErrorBody;

      if (typeof body.upstreamStatus === "number") {
        diagnostics.upstreamStatus = body.upstreamStatus;
      }
      if (body.upstreamBody !== undefined) {
        diagnostics.upstreamBody = body.upstreamBody;
      } else if (body.details !== undefined) {
        diagnostics.upstreamBody = body.details;
      }
      if (body.sentRequestBody !== undefined) {
        diagnostics.sentRequestBody = body.sentRequestBody;
      }

      if (body.message) {
        return { message: body.message, diagnostics, raw: body };
      }
      if (typeof body.error === "string") {
        return { message: body.error, diagnostics, raw: body };
      }
      if (body.error && typeof body.error === "object" && body.error.message) {
        const detailText = body.error.detail ? ` - ${body.error.detail}` : "";
        return {
          message: `${body.error.message}${detailText}`,
          diagnostics,
          raw: body.error.details ?? body,
        };
      }
      if (body.detail) {
        return {
          message: body.detail,
          diagnostics,
          raw: body.details ?? body,
        };
      }
      if (body.details !== undefined) {
        return {
          message:
            typeof body.details === "string" ? body.details : JSON.stringify(body.details),
          diagnostics,
          raw: body.details,
        };
      }

      return { message: rawText || null, diagnostics, raw: body };
    } catch {
      return { message: rawText || null, diagnostics, raw: rawText || null };
    }
  } catch {
    return { message: null, diagnostics, raw: null };
  }
}

function injectCredentials(
  body: Record<string, unknown>,
  credentials?: ProviderCredentials,
): Record<string, unknown> {
  if (!credentials) return body;
  return { ...body, credentials };
}

function getGrokImageUrls(
  params: VideoGenerationCreateInput["params"],
): string[] | undefined {
  const imageUrls = Array.from(
    new Set(
      [params.imageUrl, ...(params.imageUrls ?? []), ...(params.referenceImageUrls ?? [])].filter(
        (value): value is string => typeof value === "string" && value.trim().length > 0,
      ),
    ),
  ).slice(0, 2);

  return imageUrls.length > 0 ? imageUrls : undefined;
}

export async function createAirforceVideoGeneration(
  payload: Pick<VideoGenerationCreateInput, "model" | "params" | "credentials">,
): Promise<VideoGenerationResult> {
  const grokImageUrls =
    payload.model === "grok-imagine-video" ? getGrokImageUrls(payload.params) : undefined;

  const body = injectCredentials(
    {
      model: payload.model,
      prompt: payload.params.prompt,
      negativePrompt: payload.params.negativePrompt,
      duration: payload.params.duration,
      resolution: payload.params.resolution,
      aspectRatio: payload.params.aspectRatio,
      generateAudio: payload.params.generateAudio,
      imageUrl: payload.model === "grok-imagine-video" ? undefined : payload.params.imageUrl,
      imageUrls: payload.model === "grok-imagine-video" ? undefined : payload.params.imageUrls,
      image_urls: grokImageUrls,
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
    const { message, diagnostics, raw } = await parseErrorBody(res);
    throw new AirforceVideoError(
      res.status,
      message || `Airforce video API returned HTTP ${res.status}`,
      diagnostics,
      raw,
    );
  }

  return (await res.json()) as VideoGenerationResult;
}
