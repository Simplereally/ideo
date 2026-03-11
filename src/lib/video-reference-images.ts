import type { VideoRequestParams } from "@/lib/types";

interface VideoReferenceImageInputConfig {
  maxImages: number;
  omitAspectRatioWhenUsingReferenceImage?: boolean;
  requestField: "imageUrl" | "referenceImageUrls";
}

const VIDEO_REFERENCE_IMAGE_INPUTS: Record<string, VideoReferenceImageInputConfig> = {
  "airforce:grok-imagine-video": {
    maxImages: 2,
    requestField: "referenceImageUrls",
  },
};

export function getVideoReferenceImageInputConfig(
  modelId: string,
): VideoReferenceImageInputConfig | null {
  return VIDEO_REFERENCE_IMAGE_INPUTS[modelId] ?? null;
}

export function supportsVideoReferenceImageInput(modelId: string): boolean {
  return getVideoReferenceImageInputConfig(modelId) !== null;
}

export function applyVideoReferenceImagesToParams(
  modelId: string,
  params: VideoRequestParams,
  imageUrls: string[],
): VideoRequestParams {
  const config = getVideoReferenceImageInputConfig(modelId);
  if (!config) {
    return params;
  }

  const sanitizedUrls = imageUrls
    .map((url) => url.trim())
    .filter((url) => url.length > 0)
    .slice(0, config.maxImages);

  if (sanitizedUrls.length === 0) {
    return params;
  }

  if (config.requestField === "referenceImageUrls") {
    return {
      ...params,
      aspectRatio: config.omitAspectRatioWhenUsingReferenceImage
        ? undefined
        : params.aspectRatio,
      imageUrl: undefined,
      referenceImageUrls: sanitizedUrls,
    };
  }

  return {
    ...params,
    aspectRatio: config.omitAspectRatioWhenUsingReferenceImage
      ? undefined
      : params.aspectRatio,
    imageUrl: sanitizedUrls[0],
    referenceImageUrls: undefined,
  };
}
