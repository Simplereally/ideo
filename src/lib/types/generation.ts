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
  /** Number of images to generate when the provider supports batching. */
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

export interface GeneratedImageResult {
  imageUrl: string;
  seed?: number;
}

// ---------------------------------------------------------------------------
// Image generation response — the minimal shape every provider must return.
// ---------------------------------------------------------------------------

export interface ImageGenerationResponse {
  /** Public or presigned URL to the first generated image. */
  imageUrl?: string;
  /**
   * Optional seed echoed back by the provider (useful for reproducibility).
   * Not all providers return this.
   */
  seed?: number;
  /** All generated images, in provider order. */
  images?: GeneratedImageResult[];
}

// ---------------------------------------------------------------------------
// Runtime validation — ensures a response carries at least one usable image.
// ---------------------------------------------------------------------------

/** A narrowed type guaranteeing at least one image is present. */
export type ValidImageGenerationResponse = ImageGenerationResponse &
  (
    | { imageUrl: string }
    | { images: [GeneratedImageResult, ...GeneratedImageResult[]] }
  );

/**
 * Validates that a single entry has the minimum shape of a
 * {@link GeneratedImageResult}: an object with a non-empty `imageUrl` string.
 */
function isValidGeneratedImageResult(
  value: unknown,
): value is GeneratedImageResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "imageUrl" in value &&
    typeof (value as GeneratedImageResult).imageUrl === "string" &&
    (value as GeneratedImageResult).imageUrl.length > 0
  );
}

/**
 * Type guard that checks whether `value` is an {@link ImageGenerationResponse}
 * containing at least one usable image — either via a non-empty `imageUrl`
 * string or a non-empty `images` array where every entry is valid.
 */
export function isValidImageGenerationResponse(
  value: unknown,
): value is ValidImageGenerationResponse {
  if (typeof value !== "object" || value === null) return false;

  const resp = value as ImageGenerationResponse;

  const hasImageUrl =
    typeof resp.imageUrl === "string" && resp.imageUrl.length > 0;

  const hasImages =
    Array.isArray(resp.images) &&
    resp.images.length > 0 &&
    resp.images.every(isValidGeneratedImageResult);

  return hasImageUrl || hasImages;
}

/**
 * Asserts that `value` is a valid {@link ImageGenerationResponse} containing
 * at least one usable image.  Throws a descriptive `Error` on failure so
 * callers get an actionable message instead of a silent empty result.
 */
export function validateImageGenerationResponse(
  value: unknown,
  context?: string,
): asserts value is ValidImageGenerationResponse {
  if (isValidImageGenerationResponse(value)) return;

  const tag = context ? `[${context}] ` : "";

  if (typeof value !== "object" || value === null) {
    throw new Error(
      `${tag}Invalid image generation response: expected an object, received ${value === null ? "null" : typeof value}`,
    );
  }

  const resp = value as ImageGenerationResponse;

  if (Array.isArray(resp.images) && resp.images.length > 0) {
    const badIndex = resp.images.findIndex(
      (img) => !isValidGeneratedImageResult(img),
    );
    throw new Error(
      `${tag}Invalid image generation response: images[${badIndex}] is missing a valid imageUrl`,
    );
  }

  throw new Error(
    `${tag}Invalid image generation response: response contains neither a valid imageUrl nor a non-empty images array`,
  );
}
