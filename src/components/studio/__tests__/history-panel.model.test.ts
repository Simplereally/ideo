import { describe, expect, it } from "vitest";
import type { GeneratedImage, VideoJob } from "@/lib/types";
import type { ImageJob } from "@/store/image-jobs";
import {
  buildHistoryPanelViewModel,
  type HistoryFilter,
} from "../history-panel.model";

function createVideoJob(
  overrides: Partial<VideoJob> & Pick<VideoJob, "id" | "prompt" | "status">,
): VideoJob {
  return {
    id: overrides.id,
    model: "aiml:alibaba/wan2.1-t2v-plus",
    provider: "aiml",
    prompt: overrides.prompt,
    params: overrides.params ?? { prompt: overrides.prompt },
    status: overrides.status,
    createdAt: overrides.createdAt ?? Date.now() - 10_000,
    updatedAt: overrides.updatedAt ?? Date.now() - 10_000,
    resultUrl: overrides.resultUrl,
    error: overrides.error,
  };
}

function createImageJob(
  overrides: Partial<ImageJob> & Pick<ImageJob, "id" | "prompt" | "status">,
): ImageJob {
  return {
    id: overrides.id,
    prompt: overrides.prompt,
    model: "google:imagen-4.0-generate-001",
    provider: "google",
    aspectRatio: "1:1",
    payload: overrides.payload ?? {
      prompt: overrides.prompt,
      model: "imagen-4.0-generate-001",
      provider: "google",
      aspectRatio: "1:1",
    },
    status: overrides.status,
    attempts: overrides.attempts ?? 1,
    createdAt: overrides.createdAt ?? Date.now() - 5_000,
    updatedAt: overrides.updatedAt ?? Date.now() - 5_000,
    resultUrl: overrides.resultUrl,
    error: overrides.error,
  };
}

function createHistoryImage(
  overrides: Partial<GeneratedImage> & Pick<GeneratedImage, "id" | "prompt">,
): GeneratedImage {
  return {
    id: overrides.id,
    prompt: overrides.prompt,
    imageUrl: overrides.imageUrl ?? "https://example.com/image.png",
    aspectRatio: overrides.aspectRatio ?? "1:1",
    model: overrides.model ?? "google:imagen-4.0-generate-001",
    provider: overrides.provider ?? "google",
    createdAt: overrides.createdAt ?? Date.now() - 30_000,
    negativePrompt: overrides.negativePrompt,
    seed: overrides.seed,
  };
}

function buildModel(filter: HistoryFilter) {
  return buildHistoryPanelViewModel({
    filter,
    savedImages: [
      createHistoryImage({
        id: "image-complete",
        prompt: "Completed history image",
      }),
    ],
    selectedImageId: "image-complete",
    videoJobs: [
      createVideoJob({
        id: "video-active",
        prompt: "Active video prompt",
        status: "generating",
      }),
      createVideoJob({
        id: "video-failure",
        prompt: "Failed video prompt",
        status: "error",
      }),
      createVideoJob({
        id: "video-complete",
        prompt: "Completed video prompt",
        status: "completed",
      }),
    ],
    selectedVideoJobId: "video-active",
    imageJobs: [
      createImageJob({
        id: "image-active",
        prompt: "Active image prompt",
        status: "queued",
      }),
      createImageJob({
        id: "image-failure",
        prompt: "Failed image prompt",
        status: "cancelled",
      }),
      createImageJob({
        id: "image-hidden-complete",
        prompt: "Hidden completed image job",
        status: "completed",
      }),
    ],
  });
}

describe("buildHistoryPanelViewModel", () => {
  it("builds ordered sections for the all filter", () => {
    const model = buildModel("all");

    expect(model.hasAnyItems).toBe(true);
    expect(model.hasVisibleItems).toBe(true);
    expect(model.sections.map((section) => section.id)).toEqual([
      "active-images",
      "active-videos",
      "failures",
      "completed-videos",
      "images",
    ]);
    expect(model.sections[0]?.items[0]).toMatchObject({
      kind: "image-job",
      job: expect.objectContaining({ id: "image-active" }),
    });
    expect(model.sections[1]?.items[0]).toMatchObject({
      kind: "video-job",
      isSelected: true,
      job: expect.objectContaining({ id: "video-active" }),
    });
    expect(model.sections[4]?.items[0]).toMatchObject({
      kind: "saved-image",
      isSelected: true,
      image: expect.objectContaining({ id: "image-complete" }),
    });
    expect(model.sections[4]?.showDivider).toBe(true);
  });

  it("returns only completed sections for the complete filter", () => {
    const model = buildModel("complete");

    expect(model.sections.map((section) => section.id)).toEqual([
      "completed-videos",
      "images",
    ]);
    expect(model.sections[0]?.label).toBe("Completed Videos");
    expect(model.sections[1]?.showDivider).toBe(true);
  });

  it("returns only failure items for the failures filter", () => {
    const model = buildModel("failures");

    expect(model.sections.map((section) => section.id)).toEqual(["failures"]);
    expect(model.sections[0]?.label).toBe("Failures");
    expect(model.sections[0]?.items).toHaveLength(2);
  });

  it("provides filter-specific empty state copy when nothing matches", () => {
    const model = buildHistoryPanelViewModel({
      filter: "failures",
      savedImages: [createHistoryImage({ id: "image-1", prompt: "Saved image" })],
      selectedImageId: null,
      videoJobs: [
        createVideoJob({
          id: "video-active",
          prompt: "Active video prompt",
          status: "queued",
        }),
      ],
      selectedVideoJobId: null,
      imageJobs: [],
    });

    expect(model.hasAnyItems).toBe(true);
    expect(model.hasVisibleItems).toBe(false);
    expect(model.emptyState).toEqual({
      title: "No failures",
      description: "Failed or cancelled jobs will show up here.",
    });
  });
});
