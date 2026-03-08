import type { VideoRequestParams } from "@/lib/types";

const SUPPORTED_AIRFORCE_VIDEO_MODELS = new Set([
  "grok-imagine-video",
  "sora-2",
  "veo-3.1-fast",
  "wan-2.6",
]);

export interface AirforceMediaItem {
  url?: string;
  b64_json?: string;
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

function extractItemsFromObject(payload: Record<string, unknown>): AirforceMediaItem[] {
  if (payload.error) {
    const message =
      typeof payload.error === "string"
        ? payload.error
        : typeof payload.error === "object" &&
            payload.error !== null &&
            "message" in payload.error &&
            typeof payload.error.message === "string"
          ? payload.error.message
          : "Airforce video generation failed";
    throw new Error(message);
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

  for (const block of rawText.split(/\n\n+/)) {
    for (const line of block.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (!payload || payload === "[DONE]" || payload === ": keepalive") continue;

      const parsed = JSON.parse(payload) as Record<string, unknown>;
      const nextItems = extractItemsFromObject(parsed);
      if (nextItems.length > 0) {
        items = nextItems;
      }
    }
  }

  return items;
}

export function isSupportedAirforceVideoModel(modelId: string): boolean {
  return SUPPORTED_AIRFORCE_VIDEO_MODELS.has(modelId);
}

export function buildAirforceVideoRequest(
  modelId: string,
  params: VideoRequestParams,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: modelId,
    prompt: params.prompt,
    n: 1,
    response_format: "url",
    sse: true,
    size: "1024x1024",
  };

  switch (modelId) {
    case "grok-imagine-video": {
      body.mode = "normal";
      body.resolution = resolveStringOption(
        params.resolution,
        new Set(["480p", "720p"]),
        "480p",
      );

      if (params.imageUrl) {
        body.image_urls = [params.imageUrl];
      } else {
        body.aspectRatio = resolveStringOption(
          params.aspectRatio,
          new Set(["3:2", "2:3", "1:1"]),
          "3:2",
        );
      }
      return body;
    }
    case "sora-2": {
      body.aspectRatio = resolveStringOption(
        params.aspectRatio,
        new Set(["portrait", "landscape"]),
        "portrait",
      );
      body.duration = resolveNumberOption(
        params.duration,
        new Set([10, 15]),
        10,
      );
      if (params.imageUrl) {
        body.image_urls = [params.imageUrl];
      }
      return body;
    }
    case "veo-3.1-fast": {
      body.aspectRatio = resolveStringOption(
        params.aspectRatio,
        new Set(["16:9", "9:16"]),
        "16:9",
      );
      if (params.imageUrl) {
        body.start_frame_url = params.imageUrl;
      }
      return body;
    }
    case "wan-2.6": {
      body.aspectRatio = resolveStringOption(
        params.aspectRatio,
        new Set(["16:9", "9:16"]),
        "16:9",
      );
      body.duration = resolveNumberOption(
        params.duration,
        new Set([5, 10, 15]),
        5,
      );
      body.resolution = resolveStringOption(
        params.resolution,
        new Set(["720P", "1080P"]),
        "720P",
      );
      body.sound = params.generateAudio ?? true;
      if (params.imageUrl) {
        body.wan_image_url = params.imageUrl;
      }
      return body;
    }
    default:
      throw new Error(`Unsupported Airforce video model: ${modelId}`);
  }
}

export function extractAirforceVideoItems(rawText: string): AirforceMediaItem[] {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("data:") || trimmed.includes("\ndata:")) {
    return extractItemsFromEventStream(trimmed);
  }

  const parsed = JSON.parse(trimmed) as Record<string, unknown>;
  return extractItemsFromObject(parsed);
}
