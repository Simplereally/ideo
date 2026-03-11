import type { GeneratedImage } from "@/lib/types";
import type { ImageJob } from "@/store/image-jobs";

export interface CanvasSelectionImageSource {
  kind: "saved-image" | "image-job";
  prompt: string;
  url: string;
}

export function getSelectedCanvasImageSource({
  selectedImage,
  selectedVideoJobId,
  imageJobs,
  selectedImageJobId,
}: {
  selectedImage: GeneratedImage | null;
  selectedVideoJobId: string | null;
  imageJobs: readonly ImageJob[];
  selectedImageJobId: string | null;
}): CanvasSelectionImageSource | null {
  if (selectedVideoJobId) {
    return null;
  }

  if (selectedImageJobId) {
    const selectedImageJob = imageJobs.find((job) => job.id === selectedImageJobId);
    if (selectedImageJob?.status === "completed" && selectedImageJob.resultUrl) {
      return {
        kind: "image-job",
        prompt: selectedImageJob.prompt,
        url: selectedImageJob.resultUrl,
      };
    }

    return null;
  }

  if (!selectedImage) {
    return null;
  }

  return {
    kind: "saved-image",
    prompt: selectedImage.prompt,
    url: selectedImage.imageUrl,
  };
}
