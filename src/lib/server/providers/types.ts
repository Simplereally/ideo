import type {
  ImageGenerationRequest,
  ImageGenerationResponse,
} from "@/lib/types/generation";

// ---------------------------------------------------------------------------
// Provider adapter interface — one implementation per provider (google,
// vertex, fal, aiml).  Kept deliberately narrow: a single async method that
// accepts the shared request contract and returns the shared response.
// ---------------------------------------------------------------------------

export interface ImageProviderAdapter {
  /**
   * Generate an image from the given request.
   *
   * Implementations are responsible for:
   *  1. Mapping the canonical request into provider-specific API payloads.
   *  2. Calling the upstream provider.
   *  3. Uploading / resolving the resulting image to a public URL.
   *  4. Returning the canonical response.
   *
   * Must throw on failure — callers handle error propagation.
   */
  generateImage(
    request: ImageGenerationRequest,
  ): Promise<ImageGenerationResponse>;
}
