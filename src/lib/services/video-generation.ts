import type { Provider } from "@/lib/types";
import { createAimlVideoGeneration, getAimlVideoGeneration } from "@/lib/services/aiml-video";
import { createAirforceVideoGeneration } from "@/lib/services/airforce-video";
import type {
  VideoGenerationCreateInput,
  VideoGenerationPollInput,
  VideoGenerationResult,
  VideoServiceAdapter,
} from "@/lib/services/video-generation-types";

const VIDEO_ADAPTERS: Partial<Record<Provider, VideoServiceAdapter>> = {
  aiml: {
    create: createAimlVideoGeneration,
    get: getAimlVideoGeneration,
  },
  airforce: {
    create: createAirforceVideoGeneration,
  },
};

function getVideoAdapter(provider: Provider): VideoServiceAdapter {
  const adapter = VIDEO_ADAPTERS[provider];
  if (!adapter) {
    throw new Error(`Video generation is not configured for provider: ${provider}`);
  }
  return adapter;
}

export async function createVideoGeneration(
  input: VideoGenerationCreateInput,
): Promise<VideoGenerationResult> {
  return getVideoAdapter(input.provider).create(input);
}

export async function getVideoGeneration(
  input: VideoGenerationPollInput,
): Promise<VideoGenerationResult> {
  const adapter = getVideoAdapter(input.provider);
  if (!adapter.get) {
    throw new Error(`Provider ${input.provider} does not support video polling.`);
  }
  return adapter.get(input);
}
