export type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";

export type GenerationStatus = "idle" | "generating" | "complete" | "error";

export type Provider = "google" | "vertex" | "fal";

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
}

export interface ModelConfig {
  /** Unique composite key — "provider:model-value" */
  id: string;
  /** Actual model ID sent to the API */
  value: string;
  label: string;
  description: string;
  provider: Provider;
  capabilities: ModelCapabilities;
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
// Constants
// ---------------------------------------------------------------------------

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
    capabilities: {
      guidanceScale: { min: 1, max: 20, default: 3.5, step: 0.5 },
      numInferenceSteps: { min: 1, max: 50, default: 28, step: 1 },
      seed: true,
      enableSafetyChecker: true,
      maxImages: 4,
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

/** Get all models for a specific provider */
export function getModelsForProvider(provider: Provider): ModelConfig[] {
  return MODELS.filter((m) => m.provider === provider);
}

/** Get the first model for a given provider */
export function getDefaultModelForProvider(provider: Provider): ModelConfig | undefined {
  return MODELS.find((m) => m.provider === provider);
}

/** Provider display labels */
export const PROVIDER_LABELS: Record<Provider, string> = {
  google: "Google AI Studio",
  vertex: "Vertex AI",
  fal: "Fal AI",
};

/** Short provider labels for compact display */
export const PROVIDER_SHORT_LABELS: Record<Provider, string> = {
  google: "Google",
  vertex: "Vertex",
  fal: "Fal",
};
