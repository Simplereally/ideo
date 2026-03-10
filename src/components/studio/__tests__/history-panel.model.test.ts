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
    selectedImageJobId: null,
  });
}

describe("buildHistoryPanelViewModel", () => {
  it("builds ordered sections for the all filter", () => {
    const model = buildModel("all");

    expect(model.hasAnyItems).toBe(true);
    expect(model.hasVisibleItems).toBe(true);
    expect(model.sections.map((section) => section.id)).toEqual([
      "failures",
      "completed-videos",
      "images",
    ]);
    expect(model.sections[0]?.items[0]).toMatchObject({
      kind: "image-job",
      job: expect.objectContaining({ id: "image-failure" }),
    });
    expect(model.sections[1]?.items[0]).toMatchObject({
      kind: "video-job",
      job: expect.objectContaining({ id: "video-complete" }),
    });
    expect(model.sections[2]?.items[0]).toMatchObject({
      kind: "saved-image",
      isSelected: true,
      image: expect.objectContaining({ id: "image-complete" }),
    });
    expect(model.sections[2]?.showDivider).toBe(true);
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
    const model = buildHistoryPanelViewModel({
      filter: "failures",
      savedImages: [],
      selectedImageId: null,
      videoJobs: [
        createVideoJob({
          id: "video-failure-older",
          prompt: "Older failed video prompt",
          status: "error",
          createdAt: 1_000,
        }),
        createVideoJob({
          id: "video-failure-newest",
          prompt: "Newest failed video prompt",
          status: "cancelled",
          createdAt: 3_000,
        }),
      ],
      selectedVideoJobId: null,
      imageJobs: [
        createImageJob({
          id: "image-failure-middle",
          prompt: "Middle failed image prompt",
          status: "error",
          createdAt: 2_000,
        }),
      ],
      selectedImageJobId: null,
    });

    expect(model.sections.map((section) => section.id)).toEqual(["failures"]);
    expect(model.sections[0]?.label).toBe("Failures");
    expect(model.sections[0]?.items).toHaveLength(3);
    expect(model.sections[0]?.items.map((item) => item.key)).toEqual([
      "video-failure-newest",
      "image-failure-middle",
      "video-failure-older",
    ]);
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
      selectedImageJobId: null,
    });

    expect(model.hasAnyItems).toBe(true);
    expect(model.hasVisibleItems).toBe(false);
    expect(model.emptyState).toEqual({
      title: "No failures",
      description: "Failed or cancelled jobs will show up here.",
    });
  });

  it("explains where active jobs went when the all filter has no history yet", () => {
    const model = buildHistoryPanelViewModel({
      filter: "all",
      savedImages: [],
      selectedImageId: null,
      videoJobs: [
        createVideoJob({
          id: "video-active",
          prompt: "Still generating",
          status: "generating",
        }),
      ],
      selectedVideoJobId: null,
      imageJobs: [],
      selectedImageJobId: null,
    });

    expect(model.hasAnyItems).toBe(true);
    expect(model.hasVisibleItems).toBe(false);
    expect(model.emptyState).toEqual({
      title: "No history yet",
      description: "Active jobs stay in Queue until they finish or fail.",
    });
  });

  describe("video generation history visibility", () => {
    it("includes completed video jobs in the complete filter", () => {
      const model = buildHistoryPanelViewModel({
        filter: "complete",
        savedImages: [],
        selectedImageId: null,
        videoJobs: [
          createVideoJob({
            id: "video-completed-1",
            prompt: "First completed video",
            status: "completed",
            resultUrl: "https://example.com/video1.mp4",
          }),
          createVideoJob({
            id: "video-completed-2",
            prompt: "Second completed video",
            status: "completed",
            resultUrl: "https://example.com/video2.mp4",
          }),
          createVideoJob({
            id: "video-generating",
            prompt: "Still generating",
            status: "generating",
          }),
        ],
        selectedVideoJobId: null,
        imageJobs: [],
        selectedImageJobId: null,
      });

      expect(model.hasVisibleItems).toBe(true);
      expect(model.sections).toHaveLength(1);
      expect(model.sections[0]?.id).toBe("completed-videos");
      expect(model.sections[0]?.items).toHaveLength(2);
      expect(model.sections[0]?.items.map((item) =>
        item.kind === "video-job" ? item.job.id : null,
      )).toEqual(["video-completed-1", "video-completed-2"]);
    });

    it("includes failed video jobs in the failures filter", () => {
      const model = buildHistoryPanelViewModel({
        filter: "failures",
        savedImages: [],
        selectedImageId: null,
        videoJobs: [
          createVideoJob({
            id: "video-error",
            prompt: "Errored video",
            status: "error",
            error: "Network timeout",
          }),
          createVideoJob({
            id: "video-cancelled",
            prompt: "Cancelled video",
            status: "cancelled",
          }),
          createVideoJob({
            id: "video-completed",
            prompt: "Completed video",
            status: "completed",
          }),
        ],
        selectedVideoJobId: null,
        imageJobs: [],
        selectedImageJobId: null,
      });

      expect(model.hasVisibleItems).toBe(true);
      expect(model.sections).toHaveLength(1);
      expect(model.sections[0]?.id).toBe("failures");
      expect(model.sections[0]?.items).toHaveLength(2);
      expect(model.sections[0]?.items.map((item) =>
        item.kind === "video-job" ? item.job.id : null,
      )).toEqual(["video-error", "video-cancelled"]);
    });

    it("surfaces completed video jobs alongside saved images in complete filter", () => {
      const model = buildHistoryPanelViewModel({
        filter: "complete",
        savedImages: [
          createHistoryImage({ id: "saved-1", prompt: "Saved image" }),
        ],
        selectedImageId: null,
        videoJobs: [
          createVideoJob({
            id: "video-done",
            prompt: "Completed video",
            status: "completed",
            resultUrl: "https://example.com/video.mp4",
          }),
        ],
        selectedVideoJobId: null,
        imageJobs: [],
        selectedImageJobId: null,
      });

      expect(model.sections.map((s) => s.id)).toEqual([
        "completed-videos",
        "images",
      ]);
      expect(model.sections[0]?.items).toHaveLength(1);
      expect(model.sections[1]?.items).toHaveLength(1);
    });

    it("shows only video jobs when no saved images exist", () => {
      const model = buildHistoryPanelViewModel({
        filter: "all",
        savedImages: [],
        selectedImageId: null,
        videoJobs: [
          createVideoJob({
            id: "video-generating",
            prompt: "Generating",
            status: "generating",
          }),
          createVideoJob({
            id: "video-completed",
            prompt: "Done",
            status: "completed",
          }),
        ],
        selectedVideoJobId: "video-generating",
        imageJobs: [],
        selectedImageJobId: null,
      });

      expect(model.hasAnyItems).toBe(true);
      expect(model.hasVisibleItems).toBe(true);
      expect(model.sections.map((s) => s.id)).toEqual(["completed-videos"]);
    });

    it("tracks selection state for completed video jobs", () => {
      const model = buildHistoryPanelViewModel({
        filter: "complete",
        savedImages: [],
        selectedImageId: null,
        videoJobs: [
          createVideoJob({
            id: "video-a",
            prompt: "Video A",
            status: "completed",
          }),
          createVideoJob({
            id: "video-b",
            prompt: "Video B",
            status: "completed",
          }),
        ],
        selectedVideoJobId: "video-b",
        imageJobs: [],
        selectedImageJobId: null,
      });

      const items = model.sections[0]?.items ?? [];
      expect(items[0]).toMatchObject({
        kind: "video-job",
        isSelected: false,
        job: expect.objectContaining({ id: "video-a" }),
      });
      expect(items[1]).toMatchObject({
        kind: "video-job",
        isSelected: true,
        job: expect.objectContaining({ id: "video-b" }),
      });
    });

    it("tracks selection state for failed video jobs", () => {
      const model = buildHistoryPanelViewModel({
        filter: "failures",
        savedImages: [],
        selectedImageId: null,
        videoJobs: [
          createVideoJob({
            id: "video-err-1",
            prompt: "First error",
            status: "error",
          }),
          createVideoJob({
            id: "video-err-2",
            prompt: "Second error",
            status: "error",
          }),
        ],
        selectedVideoJobId: "video-err-1",
        imageJobs: [],
        selectedImageJobId: null,
      });

      const items = model.sections[0]?.items ?? [];
      expect(items[0]).toMatchObject({
        kind: "video-job",
        isSelected: true,
        job: expect.objectContaining({ id: "video-err-1" }),
      });
      expect(items[1]).toMatchObject({
        kind: "video-job",
        isSelected: false,
        job: expect.objectContaining({ id: "video-err-2" }),
      });
    });

    it("groups failed videos with failed images in the failures section", () => {
      const model = buildHistoryPanelViewModel({
        filter: "failures",
        savedImages: [],
        selectedImageId: null,
        videoJobs: [
          createVideoJob({
            id: "video-err",
            prompt: "Failed video",
            status: "error",
          }),
        ],
        selectedVideoJobId: null,
        imageJobs: [
          createImageJob({
            id: "image-err",
            prompt: "Failed image",
            status: "error",
          }),
        ],
        selectedImageJobId: null,
      });

      expect(model.sections).toHaveLength(1);
      expect(model.sections[0]?.id).toBe("failures");
      expect(model.sections[0]?.items).toHaveLength(2);
      expect(model.sections[0]?.items.map((item) => item.kind)).toEqual([
        "image-job",
        "video-job",
      ]);
    });

    it("returns empty state for complete filter when only active/failed jobs exist", () => {
      const model = buildHistoryPanelViewModel({
        filter: "complete",
        savedImages: [],
        selectedImageId: null,
        videoJobs: [
          createVideoJob({
            id: "video-generating",
            prompt: "Generating",
            status: "generating",
          }),
          createVideoJob({
            id: "video-error",
            prompt: "Errored",
            status: "error",
          }),
        ],
        selectedVideoJobId: null,
        imageJobs: [],
        selectedImageJobId: null,
      });

      expect(model.hasAnyItems).toBe(true);
      expect(model.hasVisibleItems).toBe(false);
      expect(model.emptyState).toEqual({
        title: "No completed items",
        description: "Completed images and videos will show up here.",
      });
    });

    it("preserves video job with resultUrl in completed section", () => {
      const resultUrl = "https://cdn.example.com/generated-video.mp4";
      const model = buildHistoryPanelViewModel({
        filter: "all",
        savedImages: [],
        selectedImageId: null,
        videoJobs: [
          createVideoJob({
            id: "video-with-url",
            prompt: "Video with result",
            status: "completed",
            resultUrl,
          }),
        ],
        selectedVideoJobId: null,
        imageJobs: [],
        selectedImageJobId: null,
      });

      const completedSection = model.sections.find(
        (s) => s.id === "completed-videos",
      );
      expect(completedSection).toBeDefined();
      const item = completedSection?.items[0];
      expect(item?.kind).toBe("video-job");
      if (item?.kind === "video-job") {
        expect(item.job.resultUrl).toBe(resultUrl);
      }
    });

    it("maintains cancelled video jobs in failures bucket", () => {
      const model = buildHistoryPanelViewModel({
        filter: "all",
        savedImages: [],
        selectedImageId: null,
        videoJobs: [
          createVideoJob({
            id: "video-cancelled",
            prompt: "User cancelled",
            status: "cancelled",
          }),
        ],
        selectedVideoJobId: null,
        imageJobs: [],
        selectedImageJobId: null,
      });

      expect(model.sections).toHaveLength(1);
      expect(model.sections[0]?.id).toBe("failures");
      expect(model.sections[0]?.items[0]).toMatchObject({
        kind: "video-job",
        job: expect.objectContaining({ id: "video-cancelled", status: "cancelled" }),
      });
    });
  });
});
