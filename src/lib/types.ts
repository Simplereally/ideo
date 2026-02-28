export type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";

export type GenerationStatus = "idle" | "generating" | "complete" | "error";

export type Provider = "google" | "fal";

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
}

export interface ModelConfig {
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
  // ---- Google Imagen (simple API — only aspect ratio + num images) ----
  {
    value: "imagen-3.0-generate-002",
    label: "Imagen 3",
    description: "Google's highest quality",
    provider: "google",
    capabilities: { maxImages: 4 },
  },
  {
    value: "imagen-3.0-fast-generate-001",
    label: "Imagen 3 Fast",
    description: "Google's fastest",
    provider: "google",
    capabilities: { maxImages: 4 },
  },

  // ---- Fal: FLUX.1 [dev] ----
  {
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

/** Helper — look up the currently-selected model config */
export function getModelConfig(modelValue: string): ModelConfig | undefined {
  return MODELS.find((m) => m.value === modelValue);
}
