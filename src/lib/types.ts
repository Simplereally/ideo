export type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";

export type GenerationStatus = "idle" | "generating" | "complete" | "error";

export type Provider = "google" | "vertex" | "fal" | "aiml" | "airforce";

// ---------------------------------------------------------------------------
// Model capabilities — drives which controls appear in the UI
// ---------------------------------------------------------------------------

export interface SliderCapability {
  min: number;
  max: number;
  default: number;
  step: number;
}

export interface ModelCapabilities {
  /** CFG / guidance scale slider */
  guidanceScale?: SliderCapability;
  /** Number of denoising steps */
  numInferenceSteps?: SliderCapability;
  /** Reproducible seed */
  seed?: boolean;
  /** fal-pro style safety tolerance (1 = strictest, 6 = most permissive) */
  safetyTolerance?: SliderCapability;
  /** fal-dev / realism boolean safety checker toggle */
  enableSafetyChecker?: boolean;
  /** Max number of images per request */
  maxImages?: number;
  /** Imagen: enhance prompt via Google's rewriter */
  enhancePrompt?: boolean;
  /** Imagen: person generation policy select */
  personGeneration?: boolean;
  /** Whether this model supports negative prompts */
  negativePrompt?: boolean;
  /** Supported aspect ratios (omit = all ratios supported) */
  aspectRatios?: AspectRatio[];

  // --- Video-specific capabilities (only relevant when kind === "video") ---

  /** Available duration options in seconds */
  durationOptions?: number[];
  /** Available resolution presets (e.g. "720p", "1080p") */
  resolutionOptions?: string[];
  /** Available video aspect ratio strings (may differ from image ratios) */
  videoAspectRatios?: string[];
  /** Whether the model can generate audio alongside video */
  generateAudio?: boolean;
  /** Whether the model accepts a reference image URL */
  imageUrl?: boolean;
  /** Whether the model accepts a reference audio URL */
  audioUrl?: boolean;
  /** Whether the model supports camera / shot-type selection */
  shotType?: boolean;
  /** Maximum characters allowed in the prompt (from API schema maxLength) */
  maxPromptLength?: number;
}

export type ModelKind = "image" | "video";

export type VideoShotType = "single" | "multi";

export interface ModelConfig {
  /** Unique composite key — "provider:model-value" */
  id: string;
  /** Actual model ID sent to the API */
  value: string;
  label: string;
  description: string;
  provider: Provider;
  /** Discriminator: image generation vs video generation */
  kind: ModelKind;
  capabilities: ModelCapabilities;
}

export function getMaxImagesForModel(modelId: string): number {
  const config = getModelConfig(modelId);
  if (!config || config.kind === "video") return 1;

  return Math.max(1, config.capabilities.maxImages ?? 1);
}

export function getBatchSizeOptions(modelId: string): number[] {
  const maxImages = getMaxImagesForModel(modelId);
  return Array.from({ length: maxImages }, (_unused, index) => index + 1);
}

// ---------------------------------------------------------------------------
// Generated image record
// ---------------------------------------------------------------------------

export interface GeneratedImage {
  id: string;
  prompt: string;
  negativePrompt?: string;
  imageUrl: string;
  aspectRatio: AspectRatio;
  model: string;
  provider: Provider;
  createdAt: number;
  seed?: number;
}

// ---------------------------------------------------------------------------
// Video generation contracts
// ---------------------------------------------------------------------------

export type VideoGenerationStatus =
  | "queued"
  | "generating"
  | "completed"
  | "error"
  | "cancelled";

/** Parameters submitted when requesting a video generation */
export interface VideoRequestParams {
  prompt: string;
  negativePrompt?: string;
  duration?: number;
  resolution?: string;
  aspectRatio?: string;
  generateAudio?: boolean;
  enhancePrompt?: boolean;
  imageUrl?: string;
  audioUrl?: string;
  shotType?: VideoShotType;
  seed?: number;
}

/** Tracks the lifecycle of an async video generation job */
export interface VideoJob {
  id: string;
  model: string;
  provider: Provider;
  prompt: string;
  params: VideoRequestParams;
  status: VideoGenerationStatus;
  createdAt: number;
  updatedAt: number;
  /** Presigned or public URL to the completed video */
  resultUrl?: string;
  /** Error message when status === "error" */
  error?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Fallback prompt length when a model does not declare maxPromptLength. */
export const DEFAULT_MAX_PROMPT_LENGTH = 4000;

export const ASPECT_RATIOS: { value: AspectRatio; label: string; icon: string }[] = [
  { value: "1:1", label: "Square", icon: "□" },
  { value: "16:9", label: "Landscape", icon: "▭" },
  { value: "9:16", label: "Portrait", icon: "▯" },
  { value: "4:3", label: "Standard", icon: "▭" },
  { value: "3:4", label: "Tall", icon: "▯" },
];

export const MODELS: ModelConfig[] = [
  // ---- Google AI Studio (Gemini Developer API — requires paid plan) ----
  {
    id: "google:imagen-4.0-generate-001",
    value: "imagen-4.0-generate-001",
    label: "Imagen 4",
    description: "Latest generation model",
    provider: "google",
    kind: "image",
    capabilities: {
      maxImages: 4,
      seed: true,
      enhancePrompt: true,
      personGeneration: true,
      aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    },
  },
  {
    id: "google:imagen-4.0-fast-generate-001",
    value: "imagen-4.0-fast-generate-001",
    label: "Imagen 4 Fast",
    description: "Fastest generation",
    provider: "google",
    kind: "image",
    capabilities: {
      maxImages: 4,
      seed: true,
      personGeneration: true,
      aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    },
  },
  {
    id: "google:imagen-4.0-ultra-generate-001",
    value: "imagen-4.0-ultra-generate-001",
    label: "Imagen 4 Ultra",
    description: "Highest quality available",
    provider: "google",
    kind: "image",
    capabilities: {
      maxImages: 4,
      seed: true,
      enhancePrompt: true,
      personGeneration: true,
      aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    },
  },

  // ---- Vertex AI (requires GCP billing + access token) ----
  {
    id: "vertex:imagen-3.0-generate-001",
    value: "imagen-3.0-generate-001",
    label: "Imagen 3",
    description: "High quality via Vertex",
    provider: "vertex",
    kind: "image",
    capabilities: {
      maxImages: 4,
      seed: true,
      negativePrompt: true,
      enhancePrompt: true,
      personGeneration: true,
      aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    },
  },
  {
    id: "vertex:imagen-3.0-fast-generate-001",
    value: "imagen-3.0-fast-generate-001",
    label: "Imagen 3 Fast",
    description: "Fast generation via Vertex",
    provider: "vertex",
    kind: "image",
    capabilities: {
      maxImages: 4,
      seed: true,
      negativePrompt: true,
      enhancePrompt: true,
      personGeneration: true,
      aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    },
  },
  {
    id: "vertex:imagen-4.0-generate-001",
    value: "imagen-4.0-generate-001",
    label: "Imagen 4",
    description: "Latest generation model",
    provider: "vertex",
    kind: "image",
    capabilities: {
      maxImages: 4,
      seed: true,
      enhancePrompt: true,
      personGeneration: true,
      aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    },
  },
  {
    id: "vertex:imagen-4.0-fast-generate-001",
    value: "imagen-4.0-fast-generate-001",
    label: "Imagen 4 Fast",
    description: "Fast latest generation",
    provider: "vertex",
    kind: "image",
    capabilities: {
      maxImages: 4,
      seed: true,
      personGeneration: true,
      aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    },
  },
  {
    id: "vertex:imagen-4.0-ultra-generate-001",
    value: "imagen-4.0-ultra-generate-001",
    label: "Imagen 4 Ultra",
    description: "Highest quality available",
    provider: "vertex",
    kind: "image",
    capabilities: {
      maxImages: 4,
      seed: true,
      enhancePrompt: true,
      personGeneration: true,
      aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    },
  },

  // ---- Fal: FLUX.1 [dev] ----
  {
    id: "fal:fal-ai/flux/dev",
    value: "fal-ai/flux/dev",
    label: "FLUX.1 [dev]",
    description: "High quality open model",
    provider: "fal",
    kind: "image",
    capabilities: {
      guidanceScale: { min: 1, max: 20, default: 3.5, step: 0.5 },
      numInferenceSteps: { min: 1, max: 50, default: 28, step: 1 },
      seed: true,
      enableSafetyChecker: true,
      maxImages: 4,
    },
  },

  // ---- Fal: FLUX.1 [pro] ----
  {
    id: "fal:fal-ai/flux-pro",
    value: "fal-ai/flux-pro",
    label: "FLUX.1 [pro]",
    description: "Best quality",
    provider: "fal",
    kind: "image",
    capabilities: {
      guidanceScale: { min: 1, max: 20, default: 3.5, step: 0.5 },
      numInferenceSteps: { min: 1, max: 50, default: 28, step: 1 },
      seed: true,
      safetyTolerance: { min: 1, max: 6, default: 2, step: 1 },
      maxImages: 4,
    },
  },

  // ---- Fal: FLUX Realism ----
  {
    id: "fal:fal-ai/flux-realism",
    value: "fal-ai/flux-realism",
    label: "FLUX.1 Realism",
    description: "Photorealistic",
    provider: "fal",
    kind: "image",
    capabilities: {
      guidanceScale: { min: 1, max: 20, default: 3.5, step: 0.5 },
      numInferenceSteps: { min: 1, max: 50, default: 28, step: 1 },
      seed: true,
      enableSafetyChecker: true,
      maxImages: 4,
    },
  },

  // ---- Fal: Nano Banana (Google's Gemini Flash Image models) ----
  {
    id: "fal:fal-ai/nano-banana",
    value: "fal-ai/nano-banana",
    label: "Nano Banana",
    description: "Google's original fast image model",
    provider: "fal",
    kind: "image",
    capabilities: {
      seed: true,
      safetyTolerance: { min: 1, max: 6, default: 4, step: 1 },
      maxImages: 4,
    },
  },
  {
    id: "fal:fal-ai/nano-banana-pro",
    value: "fal-ai/nano-banana-pro",
    label: "Nano Banana Pro",
    description: "Google's state-of-the-art image model",
    provider: "fal",
    kind: "image",
    capabilities: {
      seed: true,
      safetyTolerance: { min: 1, max: 6, default: 4, step: 1 },
      maxImages: 4,
    },
  },
  {
    id: "fal:fal-ai/nano-banana-2",
    value: "fal-ai/nano-banana-2",
    label: "Nano Banana 2",
    description: "4x faster, lower cost, better quality",
    provider: "fal",
    kind: "image",
    capabilities: {
      seed: true,
      safetyTolerance: { min: 1, max: 6, default: 4, step: 1 },
      maxImages: 4,
    },
  },

  // ---- AI/ML API: Image models ----
  {
    id: "aiml:x-ai/grok-2-image",
    value: "x-ai/grok-2-image",
    label: "Grok 2 Image",
    description: "xAI's image generation model",
    provider: "aiml",
    kind: "image",
    capabilities: {
      maxImages: 10,
      seed: true,
      // API schema has no maxLength — use default
    },
  },
  {
    id: "aiml:blackforestlabs/flux-2-pro",
    value: "blackforestlabs/flux-2-pro",
    label: "FLUX 2 Pro",
    description: "Best quality from Black Forest Labs",
    provider: "aiml",
    kind: "image",
    capabilities: {
      seed: true,
      maxPromptLength: 4000,
    },
  },
  {
    id: "aiml:blackforestlabs/flux-2",
    value: "blackforestlabs/flux-2",
    label: "FLUX 2",
    description: "Fast generation from Black Forest Labs",
    provider: "aiml",
    kind: "image",
    capabilities: {
      maxImages: 4,
      seed: true,
      maxPromptLength: 4000,
    },
  },
  {
    id: "aiml:bytedance/seedream-v4-text-to-image",
    value: "bytedance/seedream-v4-text-to-image",
    label: "Seedream v4",
    description: "ByteDance text-to-image model",
    provider: "aiml",
    kind: "image",
    capabilities: {
      maxImages: 4,
      seed: true,
      maxPromptLength: 4000,
    },
  },
  {
    id: "aiml:bytedance/seedream-4-5",
    value: "bytedance/seedream-4-5",
    label: "Seedream 4.5",
    description: "Latest ByteDance image model",
    provider: "aiml",
    kind: "image",
    capabilities: {
      seed: true,
      // API schema has no maxLength — use default
    },
  },
  {
    id: "aiml:alibaba/wan2.2-t2i-plus",
    value: "alibaba/wan2.2-t2i-plus",
    label: "Wan 2.2 T2I Plus",
    description: "High quality Alibaba text-to-image",
    provider: "aiml",
    kind: "image",
    capabilities: {
      seed: true,
      negativePrompt: true,
      enhancePrompt: true,
      maxImages: 4,
      maxPromptLength: 2000,
    },
  },
  {
    id: "aiml:alibaba/wan2.2-t2i-flash",
    value: "alibaba/wan2.2-t2i-flash",
    label: "Wan 2.2 T2I Flash",
    description: "Fast Alibaba text-to-image",
    provider: "aiml",
    kind: "image",
    capabilities: {
      seed: true,
      negativePrompt: true,
      enhancePrompt: true,
      maxImages: 4,
      maxPromptLength: 2000,
    },
  },
  {
    id: "aiml:alibaba/wan2.5-t2i-preview",
    value: "alibaba/wan2.5-t2i-preview",
    label: "Wan 2.5 T2I Preview",
    description: "Next-gen Alibaba image preview",
    provider: "aiml",
    kind: "image",
    capabilities: {
      seed: true,
      negativePrompt: true,
      enhancePrompt: true,
      maxImages: 4,
      maxPromptLength: 2000,
    },
  },
  {
    id: "aiml:alibaba/wan-2-6-image",
    value: "alibaba/wan-2-6-image",
    label: "Wan 2.6 Image",
    description: "Alibaba's image generation model",
    provider: "aiml",
    kind: "image",
    capabilities: {
      seed: true,
      negativePrompt: true,
      enhancePrompt: true,
      maxPromptLength: 2000,
    },
  },
  {
    id: "aiml:alibaba/z-image-turbo",
    value: "alibaba/z-image-turbo",
    label: "Z Image Turbo",
    description: "Alibaba's fast turbo image model",
    provider: "aiml",
    kind: "image",
    capabilities: {
      seed: true,
      // numInferenceSteps is hardcoded to 8 — no user-facing slider
      aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
      maxImages: 4,
      maxPromptLength: 4000,
    },
  },

  // ---- AI/ML API: Video models ----
  {
    id: "aiml:klingai/video-v3-pro-text-to-video",
    value: "klingai/video-v3-pro-text-to-video",
    label: "Kling v3 Pro",
    description: "KlingAI professional text-to-video",
    provider: "aiml",
    kind: "video",
    capabilities: {
      negativePrompt: true,
      generateAudio: true,
      durationOptions: [3, 5, 10, 15],
      videoAspectRatios: ["16:9", "9:16", "1:1"],
    },
  },
  {
    id: "aiml:ltxv/ltxv-2",
    value: "ltxv/ltxv-2",
    label: "LTX Video 2",
    description: "Lightweight text-to-video model",
    provider: "aiml",
    kind: "video",
    capabilities: {
      generateAudio: true,
      durationOptions: [6, 8, 10],
      resolutionOptions: ["1080p", "1440p", "2160p"],
      videoAspectRatios: ["16:9"],
    },
  },
  {
    id: "aiml:minimax/hailuo-2.3",
    value: "minimax/hailuo-2.3",
    label: "Hailuo 2.3",
    description: "MiniMax high-quality video generation",
    provider: "aiml",
    kind: "video",
    capabilities: {
      enhancePrompt: true,
      durationOptions: [6, 10],
      resolutionOptions: ["768P", "1080P"],
      maxPromptLength: 2000,
    },
  },
  {
    id: "aiml:alibaba/wan2.1-t2v-plus",
    value: "alibaba/wan2.1-t2v-plus",
    label: "Wan 2.1 T2V Plus",
    description: "Alibaba's enhanced text-to-video",
    provider: "aiml",
    kind: "video",
    capabilities: {
      seed: true,
      negativePrompt: true,
      enhancePrompt: true,
      resolutionOptions: ["720P"],
      videoAspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    },
  },
  {
    id: "aiml:alibaba/wan2.5-t2v-preview",
    value: "alibaba/wan2.5-t2v-preview",
    label: "Wan 2.5 T2V Preview",
    description: "Next-gen Alibaba video preview",
    provider: "aiml",
    kind: "video",
    capabilities: {
      seed: true,
      negativePrompt: true,
      enhancePrompt: true,
      durationOptions: [5, 10],
      resolutionOptions: ["480p", "720p", "1080p"],
      videoAspectRatios: ["16:9", "9:16", "1:1"],
    },
  },
  {
    id: "aiml:alibaba/wan-2-6-t2v",
    value: "alibaba/wan-2-6-t2v",
    label: "Wan 2.6 T2V",
    description: "Latest Alibaba text-to-video model",
    provider: "aiml",
    kind: "video",
    capabilities: {
      seed: true,
      negativePrompt: true,
      enhancePrompt: true,
      generateAudio: true,
      durationOptions: [5, 10, 15],
      resolutionOptions: ["720p", "1080p"],
      videoAspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    },
  },

  // ---- Airforce API: Image models ----
  {
    id: "airforce:grok-imagine",
    value: "grok-imagine",
    label: "Grok Imagine",
    description: "xAI's image generation model",
    provider: "airforce",
    kind: "image",
    capabilities: {
      // Verified via direct API testing: Airforce supports n=1-10
      // n>=11 returns HTTP 200 with empty data array (silent failure)
      maxImages: 10,
      seed: true,
      aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    },
  },
  {
    id: "airforce:flux-2-pro",
    value: "flux-2-pro",
    label: "FLUX 2 Pro",
    description: "High-end image generation by BFL.ai",
    provider: "airforce",
    kind: "image",
    capabilities: {
      seed: true,
      aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    },
  },
  {
    id: "airforce:wan-2.6",
    value: "wan-2.6",
    label: "Wan 2.6",
    description: "Alibaba's advanced image model",
    provider: "airforce",
    kind: "image",
    capabilities: {
      seed: true,
      negativePrompt: true,
      aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    },
  },

  // ---- Airforce API: Video models ----
  {
    id: "airforce:grok-imagine-video",
    value: "grok-imagine-video",
    label: "Grok Imagine Video",
    description: "xAI's video generation model",
    provider: "airforce",
    kind: "video",
    capabilities: {
      videoAspectRatios: ["16:9", "9:16", "1:1"],
      durationOptions: [5, 10],
    },
  },
  {
    id: "airforce:sora-2",
    value: "sora-2",
    label: "Sora 2",
    description: "OpenAI's video generation (unstable)",
    provider: "airforce",
    kind: "video",
    capabilities: {
      durationOptions: [5, 10],
    },
  },
  {
    id: "airforce:veo-3.1-fast",
    value: "veo-3.1-fast",
    label: "Veo 3.1 Fast",
    description: "Google's fast video generation",
    provider: "airforce",
    kind: "video",
    capabilities: {
      durationOptions: [5, 8],
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Look up a model config by its composite id */
export function getModelConfig(modelId: string): ModelConfig | undefined {
  return MODELS.find((m) => m.id === modelId);
}

/** Get the effective max prompt length for a model (falls back to DEFAULT_MAX_PROMPT_LENGTH). */
export function getMaxPromptLength(modelId: string): number {
  const config = getModelConfig(modelId);
  return config?.capabilities.maxPromptLength ?? DEFAULT_MAX_PROMPT_LENGTH;
}

/** Get all models for a specific provider */
export function getModelsForProvider(provider: Provider): ModelConfig[] {
  return MODELS.filter((m) => m.provider === provider);
}

/** Get the first model for a given provider */
export function getDefaultModelForProvider(provider: Provider): ModelConfig | undefined {
  return MODELS.find((m) => m.provider === provider);
}

/** Check whether a model id refers to a video model */
export function isVideoModel(modelId: string): boolean {
  return MODELS.some((m) => m.id === modelId && m.kind === "video");
}

/** Get all video models */
export function getVideoModels(): ModelConfig[] {
  return MODELS.filter((m) => m.kind === "video");
}

/** Get all image models */
export function getImageModels(): ModelConfig[] {
  return MODELS.filter((m) => m.kind === "image");
}

/** Provider display labels */
export const PROVIDER_LABELS: Record<Provider, string> = {
  google: "Google AI Studio",
  vertex: "Vertex AI",
  fal: "Fal AI",
  aiml: "AI/ML API",
  airforce: "Airforce API",
};

/** Short provider labels for compact display */
export const PROVIDER_SHORT_LABELS: Record<Provider, string> = {
  google: "Google",
  vertex: "Vertex",
  fal: "Fal",
  aiml: "AI/ML",
  airforce: "Airforce",
};

/**
 * Preferred display ordering for known providers.
 * Providers not in this list are appended at the end, sorted by label.
 */
const PROVIDER_DISPLAY_ORDER: readonly Provider[] = [
  "google",
  "vertex",
  "fal",
  "aiml",
  "airforce",
] as const;

/**
 * Derive the unique set of providers from `MODELS`, ordered deterministically:
 *   1. Known providers in `PROVIDER_DISPLAY_ORDER` (only if they have ≥ 1 model).
 *   2. Any additional providers not in the preferred list, sorted by their label.
 *
 * The result is computed once at module load — `MODELS` is a static constant.
 */
export function getProviders(): Provider[] {
  const seen = new Set<Provider>();
  for (const m of MODELS) {
    seen.add(m.provider);
  }

  // Partition into known-order and remainder.
  const ordered: Provider[] = [];
  for (const p of PROVIDER_DISPLAY_ORDER) {
    if (seen.has(p)) {
      ordered.push(p);
      seen.delete(p);
    }
  }

  // Remaining providers (if any future ones are added), sorted by label.
  const rest = Array.from(seen).sort((a, b) =>
    PROVIDER_LABELS[a].localeCompare(PROVIDER_LABELS[b]),
  );

  return [...ordered, ...rest];
}
