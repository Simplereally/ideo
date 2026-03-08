import type { Provider, VideoGenerationStatus, VideoRequestParams } from "@/lib/types";
import type { ProviderCredentials } from "@/lib/services/provider-credentials";

export interface VideoGenerationCreateInput {
  provider: Provider;
  model: string;
  params: VideoRequestParams;
  credentials?: ProviderCredentials;
}

export interface VideoGenerationPollInput {
  provider: Provider;
  generationId: string;
  credentials?: ProviderCredentials;
}

export interface VideoGenerationResult {
  id: string;
  status: VideoGenerationStatus;
  videoUrl: string | null;
  error: string | null;
  meta: Record<string, unknown>;
}

export interface VideoServiceAdapter {
  create: (input: VideoGenerationCreateInput) => Promise<VideoGenerationResult>;
  get?: (input: VideoGenerationPollInput) => Promise<VideoGenerationResult>;
}
