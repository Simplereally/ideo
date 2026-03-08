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
}

async function parseErrorBody(res: Response): Promise<string | null> {
  try {
    const rawText = await res.text();
    try {
      const body = JSON.parse(rawText) as VideoErrorBody;
      if (body.message) return body.message;
      if (typeof body.error === "string") return body.error;
      if (body.error && typeof body.error === "object" && body.error.message) {
        return body.error.message;
      }
      if (body.detail) return body.detail;
      return rawText || null;
    } catch {
      return rawText || null;
    }
  } catch {
    return null;
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
  const body = injectCredentials(
    {
      model: payload.model,
      prompt: payload.params.prompt,
      negativePrompt: payload.params.negativePrompt,
      duration: payload.params.duration,
      resolution: payload.params.resolution,
      aspectRatio: payload.params.aspectRatio,
      generateAudio: payload.params.generateAudio,
      imageUrl: payload.params.imageUrl,
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
    const message = await parseErrorBody(res);
    throw new Error(message ?? `Airforce video API returned HTTP ${res.status}`);
  }

  return (await res.json()) as VideoGenerationResult;
}
