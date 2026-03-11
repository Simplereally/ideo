import type { VideoRequestParams } from "@/lib/types";

const SUPPORTED_AIRFORCE_VIDEO_MODELS = new Set([
  "grok-imagine-video",
  "sora-2",
  "veo-3.1-fast",
  "wan-2.6",
]);

const GROK_VIDEO_ASPECT_RATIOS = new Set(["3:2", "2:3"]);
const GROK_VIDEO_RESOLUTION_TO_SIZE = {
  "3:2": {
    "480p": "854x480",
    "720p": "1280x720",
    "1080p": "1920x1080",
  },
  "2:3": {
    "480p": "480x854",
    "720p": "720x1280",
    "1080p": "1080x1920",
  },
} as const;

export interface AirforceMediaItem {
  url?: string | null;
  b64_json?: string | null;
}

interface ProviderErrorPayload {
  message?: string;
  detail?: string;
  details?: unknown;
  status?: number;
  statusCode?: number;
  code?: number | string;
}

export class AirforceVideoProviderError extends Error {
  constructor(
    public readonly httpStatus: number,
    public readonly providerPayload: unknown,
    message: string,
  ) {
    super(message);
    this.name = "AirforceVideoProviderError";
  }
}

function extractErrorStatus(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;

  const payload = value as ProviderErrorPayload;
  if (typeof payload.status === "number") return payload.status;
  if (typeof payload.statusCode === "number") return payload.statusCode;
  if (typeof payload.code === "number") return payload.code;
  if (typeof payload.code === "string") {
    const parsed = Number.parseInt(payload.code, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }

  return null;
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function extractErrorMessage(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "Airforce video generation failed";

  const payload = value as ProviderErrorPayload & { error?: unknown };
  const parts = [payload.message, payload.detail].filter(
    (part): part is string => typeof part === "string" && part.trim().length > 0,
  );

  if (parts.length > 0) {
    if (payload.details !== undefined) {
      return `${parts.join(" - ")} | ${stringifyUnknown(payload.details)}`;
    }

    return parts.join(" - ");
  }

  if (payload.details !== undefined) {
    return stringifyUnknown(payload.details);
  }

  return stringifyUnknown(value);
}

function toProviderError(value: unknown): AirforceVideoProviderError {
  const message = extractErrorMessage(value);
  const explicitStatus = extractErrorStatus(value);
  const statusFromMessage = /(?:^|\()(\d{3})\s/.exec(message)?.[1];
  const httpStatus =
    explicitStatus ?? (statusFromMessage ? Number.parseInt(statusFromMessage, 10) : 502);

  return new AirforceVideoProviderError(httpStatus, value, message);
}

function resolveStringOption(
  value: string | undefined,
  allowed: ReadonlySet<string>,
  fallback: string,
): string {
  if (value && allowed.has(value)) return value;
  return fallback;
}

function resolveNumberOption(
  value: number | undefined,
  allowed: ReadonlySet<number>,
  fallback: number,
): number {
  if (typeof value === "number" && allowed.has(value)) return value;
  return fallback;
}

function resolveReferenceImageUrls(
  params: VideoRequestParams,
  maxImages: number,
): string[] {
  const urls =
    params.referenceImageUrls?.length
      ? params.referenceImageUrls
      : params.imageUrl
        ? [params.imageUrl]
        : [];

  return urls
    .map((url) => url.trim())
    .filter((url) => url.length > 0)
    .slice(0, maxImages);
}

function extractItemsFromObject(payload: Record<string, unknown>): AirforceMediaItem[] {
  if (payload.error) {
    throw toProviderError(
      typeof payload.error === "string"
        ? {
            message: payload.error,
            detail: typeof payload.detail === "string" ? payload.detail : undefined,
            details: "details" in payload ? payload.details : undefined,
            status:
              typeof payload.status === "number"
                ? payload.status
                : typeof payload.statusCode === "number"
                  ? payload.statusCode
                  : undefined,
          }
        : payload.error,
    );
  }

  if (Array.isArray(payload.data) && payload.data.length > 0) {
    return payload.data as AirforceMediaItem[];
  }
  if (Array.isArray(payload.images) && payload.images.length > 0) {
    return payload.images as AirforceMediaItem[];
  }
  if (typeof payload.url === "string" && payload.url) {
    return [{ url: payload.url }];
  }
  if (typeof payload.video_url === "string" && payload.video_url) {
    return [{ url: payload.video_url }];
  }
  if (
    typeof payload.video === "object" &&
    payload.video !== null &&
    "url" in payload.video &&
    typeof payload.video.url === "string"
  ) {
    return [{ url: payload.video.url }];
  }
  if (typeof payload.b64_json === "string" && payload.b64_json) {
    return [{ b64_json: payload.b64_json }];
  }

  return [];
}

function extractItemsFromEventStream(rawText: string): AirforceMediaItem[] {
  let items: AirforceMediaItem[] = [];

  for (const block of rawText.split(/\r?\n\r?\n+/)) {
    const dataLines = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .filter((line) => line.length > 0);

    if (dataLines.length === 0) {
      continue;
    }

    const payload = dataLines.join("\n").trim();
    if (!payload || payload === "[DONE]") {
      continue;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(payload) as Record<string, unknown>;
    } catch {
      if (process.env.NODE_ENV === "development") {
        console.warn("[airforce-video] Skipping malformed SSE chunk:", payload.slice(0, 100));
      }
      continue;
    }

    const nextItems = extractItemsFromObject(parsed);
    if (nextItems.length > 0) {
      items = nextItems;
    }
  }

  return items;
}

function resolveGrokVideoAspectRatio(value: string | undefined): "3:2" | "2:3" {
  if (value && GROK_VIDEO_ASPECT_RATIOS.has(value)) {
    return value as "3:2" | "2:3";
  }

  return "2:3";
}

function resolveGrokVideoResolution(value: string | undefined): "480p" | "720p" | "1080p" {
  const normalized = value?.trim().toLowerCase();
  switch (normalized) {
    case "480p":
    case "720p":
    case "1080p":
      return normalized;
    default:
      return "720p";
  }
}

function resolveGrokVideoSize(
  aspectRatio: "3:2" | "2:3",
  resolution: "480p" | "720p" | "1080p",
): string {
  return GROK_VIDEO_RESOLUTION_TO_SIZE[aspectRatio][resolution];
}

function getReferenceImageUrls(params: VideoRequestParams): string[] {
  return Array.from(
    new Set(
      [params.imageUrl, ...(params.imageUrls ?? [])].filter(
        (value): value is string => typeof value === "string" && value.trim().length > 0,
      ),
    ),
  ).slice(0, 2);
}

async function resolveAirforceImageReferenceUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
    });

    return response.url || url;
  } catch {
    return url;
  }
}

async function resolveAirforceImageReferenceUrls(urls: string[]): Promise<string[]> {
  return Promise.all(urls.map((url) => resolveAirforceImageReferenceUrl(url)));
}

function buildGrokImagineVideoRequest(
  modelId: string,
  params: VideoRequestParams,
  referenceImageUrls: string[],
): Record<string, unknown> {
  const aspectRatio = resolveGrokVideoAspectRatio(params.aspectRatio);
  const resolution = resolveGrokVideoResolution(params.resolution);
  const hasReferenceImages = referenceImageUrls.length > 0;
  const body: Record<string, unknown> = {
    model: modelId,
    prompt: params.prompt,
    n: 1,
    response_format: "url",
    sse: true,
    aspectRatio,
  };

  body.size = resolveGrokVideoSize(aspectRatio, resolution);

  if (hasReferenceImages) {
    body.image_urls = referenceImageUrls;
  }

  return body;
}

export async function buildAirforceVideoRequest(
  modelId: string,
  params: VideoRequestParams,
): Promise<Record<string, unknown>> {
  const referenceImageUrls = await resolveAirforceImageReferenceUrls(
    getReferenceImageUrls(params),
  );
  const primaryReferenceImageUrl = referenceImageUrls[0] ?? params.imageUrl;

  switch (modelId) {
    case "grok-imagine-video":
      return buildGrokImagineVideoRequest(modelId, params, referenceImageUrls);
    case "sora-2": {
      const referenceImageUrls = resolveReferenceImageUrls(params, 1);
      const body: Record<string, unknown> = {
        model: modelId,
        prompt: params.prompt,
        sse: true,
        aspectRatio: resolveStringOption(
          params.aspectRatio,
          new Set(["portrait", "landscape"]),
          "portrait",
        ),
        duration: resolveNumberOption(params.duration, new Set([10, 15]), 10),
      };
      if (primaryReferenceImageUrl) {
        body.image_urls = [primaryReferenceImageUrl];
      }
      return body;
    }
    case "veo-3.1-fast": {
      const referenceImageUrls = resolveReferenceImageUrls(params, 1);
      const body: Record<string, unknown> = {
        model: modelId,
        prompt: params.prompt,
        sse: true,
        aspectRatio: resolveStringOption(
          params.aspectRatio,
          new Set(["16:9", "9:16"]),
          "16:9",
        ),
      };
      if (primaryReferenceImageUrl) {
        body.start_frame_url = primaryReferenceImageUrl;
      }
      return body;
    }
    case "wan-2.6":
      return {
        model: modelId,
        prompt: params.prompt,
        sse: true,
        duration: resolveNumberOption(params.duration, new Set([5, 10, 15]), 5),
        resolution: resolveStringOption(params.resolution, new Set(["720P", "1080P"]), "720P"),
      };
    default:
      throw new Error(`Unsupported Airforce video model: ${modelId}`);
  }
}

export function isSupportedAirforceVideoModel(modelId: string): boolean {
  return SUPPORTED_AIRFORCE_VIDEO_MODELS.has(modelId);
}

export function extractAirforceVideoItems(rawText: string): AirforceMediaItem[] {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  if (/(^|[\r\n])data:/m.test(trimmed)) {
    return extractItemsFromEventStream(trimmed);
  }

  const parsed = JSON.parse(trimmed) as Record<string, unknown>;
  return extractItemsFromObject(parsed);
}
