import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getModelConfig, type GeneratedImage } from "@/lib/types";
import { AirforceVideoError } from "@/lib/services/airforce-video";
import { resetAirforceSubmissionQueueForTests } from "@/lib/services/airforce-submission-queue";

type MockVideoCreateResult = {
  id: string;
  status: "queued";
  videoUrl: null;
  error: null;
  meta: Record<string, never>;
};

const mocks = vi.hoisted(() => ({
  createVideoGeneration: vi.fn(),
  getVideoGeneration: vi.fn(),
  pollVideoGeneration: vi.fn(),
  normalizeReferenceImageUrl: vi.fn(async (url: string) => url),
  buildProviderCredentials: vi.fn(() => undefined),
  injectCredentials: vi.fn((payload) => payload),
  completeGeneration: vi.fn(),
  setPrompt: vi.fn(),
  studioState: {
    provider: "aiml" as "aiml" | "google" | "vertex" | "fal" | "airforce",
    prompt: "",
    negativePrompt: "",
    aspectRatio: "1:1" as const,
    model: "aiml:x-ai/grok-2-image",
    numberOfImages: 1,
    guidanceScale: 3.5,
    numInferenceSteps: 28,
    seed: "",
    safetyTolerance: 2,
    enableSafetyChecker: true,
    enhancePrompt: false,
    personGeneration: "ALLOW_ADULT",
    duration: 5,
    videoResolution: "720p",
    videoAspectRatio: "16:9",
    generateAudio: false,
    videoImageUrl: "",
    useSelectedImageForVideo: false,
    videoAudioUrl: "",
    useSelectedImageAsVideoReference: false,
    videoShotType: "single" as const,
    status: "idle" as const,
    error: null,
    history: [],
    selectedImage: null as GeneratedImage | null,
    isHistoryOpen: false,
    isControlsOpen: false,
    isApiKeyDialogOpen: false,
    isImageViewerOpen: false,
  },
  videoStoreState: {
    jobs: [] as any[],
    selectedJobId: null as string | null,
    activeJobIds: [] as string[],
    addJob: vi.fn(),
    replaceJob: vi.fn(),
    updateJob: vi.fn(),
    setJobStatus: vi.fn(),
    markJobCompleted: vi.fn(),
    markJobError: vi.fn(),
    cancelJobLocal: vi.fn(),
    removeJob: vi.fn(),
    clearCompletedJobs: vi.fn(),
    selectJob: vi.fn(),
    retryJob: vi.fn(),
  },
  imageStoreState: {
    jobs: [] as any[],
    addJob: vi.fn(),
    setJobStatus: vi.fn(),
    startJob: vi.fn(),
    markJobCompleted: vi.fn(),
    markJobError: vi.fn(),
    cancelJobLocal: vi.fn(),
    removeJob: vi.fn(),
    clearTerminalJobs: vi.fn(),
    retryJob: vi.fn(),
  },
}));

vi.mock("@/lib/services/video-generation", () => ({
  createVideoGeneration: mocks.createVideoGeneration,
  getVideoGeneration: mocks.getVideoGeneration,
}));

vi.mock("@/lib/services/video-polling", () => ({
  pollVideoGeneration: mocks.pollVideoGeneration,
}));

vi.mock("@/lib/services/provider-credentials", () => ({
  buildProviderCredentials: mocks.buildProviderCredentials,
  injectCredentials: mocks.injectCredentials,
}));

vi.mock("@/lib/services/reference-image-upload", () => ({
  normalizeReferenceImageUrl: mocks.normalizeReferenceImageUrl,
}));

vi.mock("@/store/settings", () => ({
  useSettingsStore: {
    getState: () => ({}),
  },
}));

vi.mock("@/lib/store", () => ({
  useStudio: () => ({
    state: mocks.studioState,
    setProvider: vi.fn(),
    setPrompt: mocks.setPrompt,
    setNegativePrompt: vi.fn(),
    setAspectRatio: vi.fn(),
    setNumInferenceSteps: vi.fn(),
    setSeed: vi.fn(),
    setSafetyTolerance: vi.fn(),
    setEnableSafetyChecker: vi.fn(),
    setEnhancePrompt: vi.fn(),
    setPersonGeneration: vi.fn(),
    setModel: vi.fn(),
    setNumberOfImages: vi.fn(),
    setGuidanceScale: vi.fn(),
    setDuration: vi.fn(),
    setVideoResolution: vi.fn(),
    setVideoAspectRatio: vi.fn(),
    setGenerateAudio: vi.fn(),
    setVideoImageUrl: vi.fn(),
    setUseSelectedImageForVideo: vi.fn(),
    setVideoAudioUrl: vi.fn(),
    setUseSelectedImageAsVideoReference: vi.fn(),
    setVideoShotType: vi.fn(),
    startGeneration: vi.fn(),
    completeGeneration: mocks.completeGeneration,
    failGeneration: vi.fn(),
    selectImage: vi.fn(),
    removeImage: vi.fn(),
    clearHistory: vi.fn(),
    toggleHistory: vi.fn(),
    toggleControls: vi.fn(),
    openApiKeyDialog: vi.fn(),
    closeApiKeyDialog: vi.fn(),
    openImageViewer: vi.fn(),
    closeImageViewer: vi.fn(),
    resetStatus: vi.fn(),
  }),
}));

vi.mock("@/store/video-jobs", () => ({
  useVideoJobsStore: Object.assign(
    (selector?: (state: typeof mocks.videoStoreState) => unknown) =>
      selector ? selector(mocks.videoStoreState) : mocks.videoStoreState,
    {
      subscribe: () => () => {},
      getState: () => mocks.videoStoreState,
    },
  ),
}));

vi.mock("@/store/image-jobs", () => ({
  useImageJobsStore: Object.assign(
    (selector?: (state: typeof mocks.imageStoreState) => unknown) =>
      selector ? selector(mocks.imageStoreState) : mocks.imageStoreState,
    {
      subscribe: () => () => {},
      getState: () => mocks.imageStoreState,
    },
  ),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  GenerationActionsProvider,
  useGenerationActions,
} from "../generation-actions";

function Harness() {
  const { generateFromCurrentState, retryVideoJob, retryImageJob } =
    useGenerationActions();

  return (
    <div>
      <button type="button" onClick={() => void generateFromCurrentState()}>
        Generate image
      </button>
      <button type="button" onClick={() => void retryVideoJob("video-error-1")}>
        Retry video
      </button>
      <button type="button" onClick={() => retryImageJob("image-error-1")}>
        Retry image
      </button>
    </div>
  );
}

describe("GenerationActionsProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    resetAirforceSubmissionQueueForTests();
    mocks.videoStoreState.jobs = [];
    mocks.videoStoreState.selectedJobId = null;
    mocks.imageStoreState.jobs = [];
    global.fetch = vi.fn();
    mocks.normalizeReferenceImageUrl.mockImplementation(async (url: string) => url);

    mocks.pollVideoGeneration.mockReturnValue({
      cancel: vi.fn(),
      promise: Promise.resolve({
        id: "new-video-id",
        status: "queued",
        videoUrl: null,
        error: null,
        meta: {},
      }),
    });
  });

  it("optimistically enqueues fresh video generations before the create request resolves", async () => {
    mocks.studioState.provider = "aiml" as const;
    mocks.studioState.model = "aiml:klingai/video-v3-pro-text-to-video";
    mocks.studioState.prompt = "A paper lantern drifting through fog";

    let resolveCreate: ((value: MockVideoCreateResult) => void) | undefined;

    mocks.createVideoGeneration.mockImplementation(
      () =>
        new Promise<MockVideoCreateResult>((resolve) => {
          resolveCreate = resolve;
        }),
    );

    render(
      <GenerationActionsProvider>
        <Harness />
      </GenerationActionsProvider>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /generate image/i }));

    expect(mocks.videoStoreState.addJob).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "aiml:klingai/video-v3-pro-text-to-video",
        provider: "aiml",
        prompt: "A paper lantern drifting through fog",
        status: "queued",
        requestPending: true,
      }),
    );
    expect(mocks.videoStoreState.selectJob).toHaveBeenCalledWith(expect.any(String));
    expect(mocks.videoStoreState.replaceJob).not.toHaveBeenCalled();

    if (!resolveCreate) {
      throw new Error("Expected createVideoGeneration to be pending");
    }

    resolveCreate({
      id: "video-created-1",
      status: "queued",
      videoUrl: null,
      error: null,
      meta: {},
    });

    await waitFor(() => {
      expect(mocks.videoStoreState.replaceJob).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          id: "video-created-1",
          model: "aiml:klingai/video-v3-pro-text-to-video",
          provider: "aiml",
          status: "queued",
          requestPending: false,
        }),
      );
    });
  });

  it("allows multiple video submissions to queue while earlier create requests are still pending", async () => {
    mocks.studioState.provider = "aiml" as const;
    mocks.studioState.model = "aiml:klingai/video-v3-pro-text-to-video";
    mocks.studioState.prompt = "A paper lantern drifting through fog";

    let createCallCount = 0;
    mocks.createVideoGeneration.mockImplementation(
      () =>
        new Promise<MockVideoCreateResult>((resolve) => {
          createCallCount += 1;
          const callNumber = createCallCount;
          setTimeout(
            () =>
              resolve({
                id: `video-created-${callNumber}`,
                status: "queued",
                videoUrl: null,
                error: null,
                meta: {},
              }),
            0,
          );
        }),
    );

    render(
      <GenerationActionsProvider>
        <Harness />
      </GenerationActionsProvider>,
    );

    const user = userEvent.setup();
    const generateButton = screen.getByRole("button", { name: /generate image/i });

    await user.click(generateButton);
    await user.click(generateButton);

    expect(mocks.videoStoreState.addJob).toHaveBeenCalledTimes(2);

    await waitFor(() => {
      expect(mocks.createVideoGeneration).toHaveBeenCalledTimes(2);
      expect(mocks.videoStoreState.replaceJob).toHaveBeenCalledTimes(2);
    });
  });

  it("keeps a queued video job cancelled when the create request resolves afterward", async () => {
    mocks.studioState.provider = "aiml" as const;
    mocks.studioState.model = "aiml:klingai/video-v3-pro-text-to-video";
    mocks.studioState.prompt = "Cancel me before the provider accepts it";

    let resolveCreate: ((value: MockVideoCreateResult) => void) | undefined;
    mocks.createVideoGeneration.mockImplementation(
      () =>
        new Promise<MockVideoCreateResult>((resolve) => {
          resolveCreate = resolve;
        }),
    );

    render(
      <GenerationActionsProvider>
        <Harness />
      </GenerationActionsProvider>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /generate image/i }));

    const pendingJob = mocks.videoStoreState.addJob.mock.calls[0]?.[0];
    if (!pendingJob || !resolveCreate) {
      throw new Error("Expected a pending video job to be queued");
    }

    mocks.videoStoreState.jobs = [
      {
        ...pendingJob,
        status: "cancelled",
      },
    ];

    resolveCreate({
      id: "video-created-cancelled",
      status: "queued",
      videoUrl: null,
      error: null,
      meta: {},
    });

    await waitFor(() => {
      expect(mocks.videoStoreState.replaceJob).toHaveBeenCalledWith(
        pendingJob.id,
        expect.objectContaining({
          id: "video-created-cancelled",
          status: "cancelled",
          requestPending: false,
        }),
      );
    });

    expect(mocks.pollVideoGeneration).not.toHaveBeenCalled();
    expect(mocks.videoStoreState.markJobCompleted).not.toHaveBeenCalled();
    expect(mocks.videoStoreState.markJobError).not.toHaveBeenCalled();
  });

  it(
    "retries failed video jobs with the exact stored params and replaces the failed entry",
    { timeout: 15000 },
    async () => {
      const videoModelId = "aiml:klingai/video-v3-pro-text-to-video";
      const retryPayload = {
        model: videoModelId,
        provider: "aiml" as const,
        params: {
          prompt: "A storm over the ocean",
          duration: 5,
          generateAudio: true,
        },
      };

      mocks.videoStoreState.retryJob.mockReturnValue(retryPayload);
      mocks.createVideoGeneration.mockResolvedValue({
        id: "new-video-id",
        status: "queued",
        videoUrl: null,
        error: null,
        meta: {},
      });

      render(
        <GenerationActionsProvider>
          <Harness />
        </GenerationActionsProvider>,
      );

      await userEvent
        .setup()
        .click(screen.getByRole("button", { name: /retry video/i }));

      await waitFor(() => {
        expect(mocks.createVideoGeneration).toHaveBeenCalledWith({
          provider: "aiml",
          model: getModelConfig(videoModelId)!.value,
          params: retryPayload.params,
          credentials: undefined,
        });
      });

      expect(mocks.videoStoreState.replaceJob).toHaveBeenNthCalledWith(
        1,
        "video-error-1",
        expect.objectContaining({
          model: videoModelId,
          provider: "aiml",
          params: retryPayload.params,
          prompt: retryPayload.params.prompt,
          status: "queued",
          requestPending: true,
        }),
      );
      expect(mocks.videoStoreState.replaceJob).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        expect.objectContaining({
          id: "new-video-id",
          model: videoModelId,
          provider: "aiml",
          params: retryPayload.params,
          prompt: retryPayload.params.prompt,
          status: "queued",
          requestPending: false,
        }),
      );
      expect(mocks.videoStoreState.addJob).not.toHaveBeenCalled();
      expect(mocks.videoStoreState.selectJob).toHaveBeenCalledWith(expect.any(String));
    },
  );

  it(
    "retries failed image jobs with the exact stored payload and replaces the failed entry",
    { timeout: 15000 },
    async () => {
      const retryPayload = {
        prompt: "A neon city skyline",
        model: "aiml:x-ai/grok-2-image",
        provider: "aiml" as const,
        aspectRatio: "1:1" as const,
        payload: {
          prompt: "A neon city skyline",
          model: "x-ai/grok-2-image",
          provider: "aiml" as const,
          aspectRatio: "1:1" as const,
          negativePrompt: "rain",
        },
      };

      mocks.imageStoreState.retryJob.mockReturnValue(retryPayload);
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({
          imageUrl: "https://example.com/retried-image.png",
        }),
      });

      render(
        <GenerationActionsProvider>
          <Harness />
        </GenerationActionsProvider>,
      );

      await userEvent
        .setup()
        .click(screen.getByRole("button", { name: /retry image/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/generate/aiml",
          expect.objectContaining({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(retryPayload.payload),
            signal: expect.any(AbortSignal),
          }),
        );
      });

      expect(mocks.imageStoreState.addJob).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: retryPayload.prompt,
          model: retryPayload.model,
          provider: retryPayload.provider,
          aspectRatio: retryPayload.aspectRatio,
          payload: retryPayload.payload,
          status: "queued",
        }),
      );
      expect(mocks.imageStoreState.removeJob).toHaveBeenCalledWith(
        "image-error-1",
      );
      expect(mocks.completeGeneration).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: retryPayload.prompt,
          model: retryPayload.model,
          provider: retryPayload.provider,
          imageUrl: "https://example.com/retried-image.png",
        }),
      );
    },
  );

  it("completes direct-result Airforce video jobs without polling", async () => {
    mocks.studioState.provider = "airforce" as const;
    mocks.studioState.model = "airforce:wan-2.6";
    mocks.studioState.prompt = "A neon koi fish swimming through clouds";
    mocks.studioState.videoAspectRatio = "9:16"; // ignored by wan-2.6 Airforce adapter
    mocks.studioState.videoResolution = "720P";
    mocks.studioState.duration = 5;
    mocks.studioState.generateAudio = true; // ignored by wan-2.6 Airforce adapter

    mocks.createVideoGeneration.mockResolvedValue({
      id: "airforce-video-1",
      status: "completed",
      videoUrl: "https://example.com/wan.mp4",
      error: null,
      meta: {},
    });

    render(
      <GenerationActionsProvider>
        <Harness />
      </GenerationActionsProvider>,
    );

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /generate image/i }));

    // Note: aspectRatio and generateAudio are omitted for wan-2.6 through Airforce
    // because these fields are undocumented and may cause upstream 500s
    await waitFor(() => {
      expect(mocks.createVideoGeneration).toHaveBeenCalledWith({
        provider: "airforce",
        model: "wan-2.6",
        params: {
          prompt: "A neon koi fish swimming through clouds",
          duration: 5,
          resolution: "720P",
        },
        credentials: undefined,
      });
    });

    expect(mocks.videoStoreState.addJob).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "airforce:wan-2.6",
        provider: "airforce",
        status: "queued",
        requestPending: true,
      }),
    );
    expect(mocks.videoStoreState.replaceJob).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        id: "airforce-video-1",
        model: "airforce:wan-2.6",
        provider: "airforce",
        status: "completed",
        requestPending: false,
      }),
    );
    expect(mocks.videoStoreState.selectJob).toHaveBeenCalledWith(expect.any(String));
    expect(mocks.videoStoreState.markJobCompleted).toHaveBeenCalledWith(
      "airforce-video-1",
      "https://example.com/wan.mp4",
    );
    expect(mocks.pollVideoGeneration).not.toHaveBeenCalled();
    expect(mocks.setPrompt).not.toHaveBeenCalled();
  });

  it("sends both the pasted and selected history image for Airforce Grok Imagine Video", async () => {
    mocks.studioState.provider = "airforce" as const;
    mocks.studioState.model = "airforce:grok-imagine-video";
    mocks.studioState.prompt = "Turn both stills into a single moving shot";
    mocks.studioState.videoAspectRatio = "3:2";
    mocks.studioState.videoResolution = "720p";
    mocks.studioState.videoImageUrl = "https://example.com/pasted.png";
    mocks.studioState.useSelectedImageAsVideoReference = true;
    mocks.studioState.selectedImage = {
      id: "history-image-1",
      prompt: "History image",
      negativePrompt: undefined,
      imageUrl: "https://example.com/history.png",
      aspectRatio: "1:1",
      model: "google:imagen-4.0-generate-001",
      provider: "google",
      createdAt: Date.now(),
    };

    mocks.createVideoGeneration.mockResolvedValue({
      id: "airforce-grok-video-1",
      status: "completed",
      videoUrl: "https://example.com/grok.mp4",
      error: null,
      meta: {},
    });
    mocks.normalizeReferenceImageUrl.mockImplementation(async (url: string) =>
      url.replace(".png", "-normalized.png"),
    );
    render(
      <GenerationActionsProvider>
        <Harness />
      </GenerationActionsProvider>,
    );

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /generate image/i }));

    await waitFor(() => {
      expect(mocks.createVideoGeneration).toHaveBeenCalledWith({
        provider: "airforce",
        model: "grok-imagine-video",
        params: {
          prompt: "Turn both stills into a single moving shot",
          aspectRatio: "3:2",
          resolution: "720p",
          imageUrl: "https://example.com/pasted-normalized.png",
          imageUrls: [
            "https://example.com/pasted-normalized.png",
            "https://example.com/history-normalized.png",
          ],
        },
        credentials: undefined,
      });
    });

    expect(mocks.normalizeReferenceImageUrl).toHaveBeenCalledTimes(2);

    mocks.studioState.videoImageUrl = "";
    mocks.studioState.useSelectedImageAsVideoReference = false;
    mocks.studioState.selectedImage = null;
  });

  it("uses the selected history image directly for Airforce Grok Imagine Video", async () => {
    mocks.studioState.provider = "airforce" as const;
    mocks.studioState.model = "airforce:grok-imagine-video";
    mocks.studioState.prompt = "Use the selected image directly";
    mocks.studioState.videoAspectRatio = "3:2";
    mocks.studioState.videoResolution = "480p";
    mocks.studioState.useSelectedImageAsVideoReference = true;
    mocks.studioState.selectedImage = {
      id: "history-image-2",
      prompt: "History image",
      negativePrompt: undefined,
      imageUrl: "https://example.com/direct.png",
      aspectRatio: "1:1",
      model: "google:imagen-4.0-generate-001",
      provider: "google",
      createdAt: Date.now(),
    };
    mocks.createVideoGeneration.mockResolvedValue({
      id: "airforce-grok-video-2",
      status: "completed",
      videoUrl: "https://example.com/grok-2.mp4",
      error: null,
      meta: {},
    });
    mocks.normalizeReferenceImageUrl.mockImplementation(async (url: string) =>
      url.replace(".png", "-normalized.png"),
    );
    render(
      <GenerationActionsProvider>
        <Harness />
      </GenerationActionsProvider>,
    );

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /generate image/i }));

    await waitFor(() => {
      expect(mocks.createVideoGeneration).toHaveBeenCalledWith({
        provider: "airforce",
        model: "grok-imagine-video",
        params: {
          prompt: "Use the selected image directly",
          aspectRatio: "3:2",
          resolution: "480p",
          imageUrls: ["https://example.com/direct-normalized.png"],
        },
        credentials: undefined,
      });
    });

    expect(mocks.normalizeReferenceImageUrl).toHaveBeenCalledTimes(1);

    mocks.studioState.useSelectedImageAsVideoReference = false;
    mocks.studioState.selectedImage = null;
  });

  it("falls back to the original image URL when normalization returns a localhost proxy", async () => {
    mocks.studioState.provider = "airforce" as const;
    mocks.studioState.model = "airforce:grok-imagine-video";
    mocks.studioState.prompt = "Keep the original provider-safe URL";
    mocks.studioState.videoAspectRatio = "2:3";
    mocks.studioState.videoResolution = "480p";
    mocks.studioState.videoImageUrl = "https://example.com/original.png";
    mocks.createVideoGeneration.mockResolvedValue({
      id: "airforce-grok-video-3",
      status: "completed",
      videoUrl: "https://example.com/grok-3.mp4",
      error: null,
      meta: {},
    });
    mocks.normalizeReferenceImageUrl.mockResolvedValue(
      "http://localhost:3000/api/reference-image?src=https%3A%2F%2Fexample.com%2Foriginal.png",
    );

    render(
      <GenerationActionsProvider>
        <Harness />
      </GenerationActionsProvider>,
    );

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /generate image/i }));

    await waitFor(() => {
      expect(mocks.createVideoGeneration).toHaveBeenCalledWith({
        provider: "airforce",
        model: "grok-imagine-video",
        params: {
          prompt: "Keep the original provider-safe URL",
          aspectRatio: "2:3",
          resolution: "480p",
          imageUrl: "https://example.com/original.png",
          imageUrls: ["https://example.com/original.png"],
        },
        credentials: undefined,
      });
    });

    expect(mocks.normalizeReferenceImageUrl).toHaveBeenCalledTimes(1);

    mocks.studioState.videoImageUrl = "";
    mocks.studioState.useSelectedImageAsVideoReference = false;
    mocks.studioState.selectedImage = null;
  });

  it("uses the selected canvas image for Airforce Grok video when enabled", async () => {
    mocks.studioState.provider = "airforce" as const;
    mocks.studioState.model = "airforce:grok-imagine-video";
    mocks.studioState.prompt = "Turn this still into a cinematic reveal";
    mocks.studioState.videoAspectRatio = "3:2";
    mocks.studioState.videoResolution = "720p";
    mocks.studioState.useSelectedImageForVideo = true;
    mocks.studioState.selectedImage = {
      id: "image-1",
      prompt: "A cinematic portrait",
      imageUrl: "https://example.com/source-image.png",
      aspectRatio: "1:1",
      model: "google:imagen-4.0-generate-001",
      provider: "google",
      createdAt: Date.now(),
    };

    mocks.createVideoGeneration.mockResolvedValue({
      id: "airforce-grok-video-1",
      status: "completed",
      videoUrl: "https://example.com/grok-video.mp4",
      error: null,
      meta: {},
    });

    render(
      <GenerationActionsProvider>
        <Harness />
      </GenerationActionsProvider>,
    );

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /generate image/i }));

    await waitFor(() => {
      expect(mocks.createVideoGeneration).toHaveBeenCalledWith({
        provider: "airforce",
        model: "grok-imagine-video",
        params: expect.objectContaining({
          prompt: "Turn this still into a cinematic reveal",
          aspectRatio: "3:2",
          resolution: "720p",
          referenceImageUrls: ["https://example.com/source-image.png"],
        }),
        credentials: undefined,
      });
    });
  });

  it("forwards batch size and records every returned image for image generation", async () => {
    mocks.studioState.prompt = "A brutalist house in fog";
    mocks.studioState.model = "google:imagen-4.0-generate-001";
    mocks.studioState.provider = "google";
    mocks.studioState.numberOfImages = 3;

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        imageUrl: "https://example.com/image-1.png",
        images: [
          { imageUrl: "https://example.com/image-1.png" },
          { imageUrl: "https://example.com/image-2.png" },
          { imageUrl: "https://example.com/image-3.png" },
        ],
      }),
    });

    render(
      <GenerationActionsProvider>
        <Harness />
      </GenerationActionsProvider>,
    );

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /generate image/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/generate/google",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: expect.any(AbortSignal),
        }),
      );
    });

    const fetchArgs = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(fetchArgs[1].body));

    expect(payload).toEqual(
      expect.objectContaining({
        prompt: "A brutalist house in fog",
        provider: "google",
        aspectRatio: "1:1",
        numberOfImages: 3,
      }),
    );
    expect(mocks.imageStoreState.markJobCompleted).toHaveBeenCalledWith(
      expect.any(String),
      "https://example.com/image-1.png",
    );
    expect(mocks.completeGeneration).toHaveBeenCalledTimes(3);
    // Calls arrive in reverse order (3→2→1) because generatedImages.toReversed()
    // iterates last-to-first; completeGeneration prepends to history, so this
    // ensures the final display order is 1→N.
    expect(
      mocks.completeGeneration.mock.calls.map(
        ([image]) => image.imageUrl,
      ),
    ).toEqual([
      "https://example.com/image-3.png",
      "https://example.com/image-2.png",
      "https://example.com/image-1.png",
    ]);    
  });

  it("requeues Airforce image jobs when the provider asks to retry in X seconds", async () => {
    vi.useFakeTimers();

    mocks.studioState.prompt = "A cinematic lighthouse in fog";
    mocks.studioState.model = "airforce:grok-imagine";
    mocks.studioState.provider = "airforce";

    (global.fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error:
              "Rate limit exceeded (1 request(s) per minute). Try again in 2 seconds. discord.gg/airforce",
            upstreamStatus: 429,
            upstreamBody: {
              error:
                "Rate limit exceeded (1 request(s) per minute). Try again in 2 seconds. discord.gg/airforce",
            },
          }),
          {
            status: 429,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            imageUrl: "https://example.com/airforce-image.png",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    render(
      <GenerationActionsProvider>
        <Harness />
      </GenerationActionsProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /generate image/i }));

    await Promise.resolve();
    await Promise.resolve();

    expect(global.fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_250);
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(mocks.imageStoreState.setJobStatus).toHaveBeenCalledWith(
      expect.any(String),
      "queued",
    );
    expect(mocks.imageStoreState.markJobError).not.toHaveBeenCalled();
    expect(mocks.imageStoreState.markJobCompleted).toHaveBeenCalledWith(
      expect.any(String),
      "https://example.com/airforce-image.png",
    );

    vi.useRealTimers();
  });

  it("retries Airforce video submissions after the provider wait window instead of failing immediately", async () => {
    vi.useFakeTimers();

    mocks.studioState.provider = "airforce" as const;
    mocks.studioState.model = "airforce:wan-2.6";
    mocks.studioState.prompt = "A glass elevator moving through clouds";
    mocks.studioState.videoResolution = "720P";
    mocks.studioState.duration = 5;

    mocks.createVideoGeneration
      .mockRejectedValueOnce(
        new AirforceVideoError(
          429,
          "Rate limit exceeded (1 request(s) per minute). Try again in 3 seconds. discord.gg/airforce",
          {
            upstreamStatus: 429,
            upstreamBody: {
              error:
                "Rate limit exceeded (1 request(s) per minute). Try again in 3 seconds. discord.gg/airforce",
            },
          },
        ),
      )
      .mockResolvedValueOnce({
        id: "airforce-video-retried",
        status: "completed",
        videoUrl: "https://example.com/retried.mp4",
        error: null,
        meta: {},
      });

    render(
      <GenerationActionsProvider>
        <Harness />
      </GenerationActionsProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /generate image/i }));

    await Promise.resolve();
    await Promise.resolve();

    expect(mocks.createVideoGeneration).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_250);
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(mocks.createVideoGeneration).toHaveBeenCalledTimes(2);
    expect(mocks.videoStoreState.markJobError).not.toHaveBeenCalled();
    expect(mocks.videoStoreState.updateJob).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        status: "queued",
        requestPending: true,
      }),
    );
    expect(mocks.videoStoreState.markJobCompleted).toHaveBeenCalledWith(
      "airforce-video-retried",
      "https://example.com/retried.mp4",
    );

    vi.useRealTimers();
  });

  it("marks video job as failed when initial submission fails (parity with image failure)", async () => {
    mocks.studioState.provider = "aiml" as const;
    mocks.studioState.model = "aiml:klingai/video-v3-pro-text-to-video";
    mocks.studioState.prompt = "A sunset over mountains";
    mocks.studioState.duration = 5;

    const apiError = new Error("API key invalid");
    mocks.createVideoGeneration.mockRejectedValue(apiError);

    render(
      <GenerationActionsProvider>
        <Harness />
      </GenerationActionsProvider>,
    );

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /generate image/i }));

    await waitFor(() => {
      expect(mocks.createVideoGeneration).toHaveBeenCalled();
    });

    // Temporary job should be added first (queued state)
    expect(mocks.videoStoreState.addJob).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "queued",
        prompt: "A sunset over mountains",
      }),
    );

    // On failure, the job should be marked as error (not removed)
    await waitFor(() => {
      expect(mocks.videoStoreState.markJobError).toHaveBeenCalledWith(
        expect.any(String),
        "API key invalid",
      );
    });

    // The job should NOT be removed — it stays in history for retry
    expect(mocks.videoStoreState.removeJob).not.toHaveBeenCalled();
  });
});
