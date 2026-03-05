import type { AspectRatio, Provider } from "@/lib/types";

// ---------------------------------------------------------------------------
// Image generation request — union of all fields currently consumed by
// provider branches in the prompt composer.  Every field beyond `prompt`,
// `model`, `provider`, and `aspectRatio` is optional because capabilities
// vary per model.
// ---------------------------------------------------------------------------

export interface ImageGenerationRequest {
  /** The user prompt — always required. */
  prompt: string;
  /** Composite model id ("provider:model-value"). */
  model: string;
  /** Provider discriminator. */
  provider: Provider;
  /** Target aspect ratio. */
  aspectRatio: AspectRatio;

  // -- Optional fields gated by ModelCapabilities --

  negativePrompt?: string;
  seed?: number;
  /** Number of images to generate (providers currently cap at 1). */
  numberOfImages?: number;

  // fal-specific
  guidanceScale?: number;
  numInferenceSteps?: number;
  safetyTolerance?: number;
  enableSafetyChecker?: boolean;

  // google / vertex / aiml
  enhancePrompt?: boolean;

  // vertex
  personGeneration?: string;
}

// ---------------------------------------------------------------------------
// Image generation response — the minimal shape every provider must return.
// ---------------------------------------------------------------------------

export interface ImageGenerationResponse {
  /** Public or presigned URL to the generated image. */
  imageUrl: string;
  /**
   * Optional seed echoed back by the provider (useful for reproducibility).
   * Not all providers return this.
   */
  seed?: number;
}
