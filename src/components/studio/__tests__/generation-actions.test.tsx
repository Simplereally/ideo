import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getModelConfig } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  createVideoGeneration: vi.fn(),
  getVideoGeneration: vi.fn(),
  pollVideoGeneration: vi.fn(),
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
    videoAudioUrl: "",
    videoShotType: "single" as const,
    status: "idle" as const,
    error: null,
    history: [],
    selectedImage: null,
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
    setVideoAudioUrl: vi.fn(),
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
    mocks.videoStoreState.jobs = [];
    mocks.videoStoreState.selectedJobId = null;
    mocks.imageStoreState.jobs = [];
    global.fetch = vi.fn();

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

      expect(mocks.videoStoreState.addJob).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "new-video-id",
          model: videoModelId,
          provider: "aiml",
          params: retryPayload.params,
          prompt: retryPayload.params.prompt,
          status: "queued",
        }),
      );
      expect(mocks.videoStoreState.removeJob).toHaveBeenCalledWith(
        "video-error-1",
      );
      expect(mocks.videoStoreState.selectJob).toHaveBeenCalledWith(
        "new-video-id",
      );
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
    mocks.studioState.videoAspectRatio = "9:16";
    mocks.studioState.videoResolution = "720P";
    mocks.studioState.duration = 5;
    mocks.studioState.generateAudio = true;

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

    await waitFor(() => {
      expect(mocks.createVideoGeneration).toHaveBeenCalledWith({
        provider: "airforce",
        model: "wan-2.6",
        params: {
          prompt: "A neon koi fish swimming through clouds",
          duration: 5,
          resolution: "720P",
          aspectRatio: "9:16",
          generateAudio: true,
        },
        credentials: undefined,
      });
    });

    expect(mocks.videoStoreState.addJob).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "airforce-video-1",
        model: "airforce:wan-2.6",
        provider: "airforce",
        status: "completed",
      }),
    );
    expect(mocks.videoStoreState.selectJob).toHaveBeenCalledWith(
      "airforce-video-1",
    );
    expect(mocks.videoStoreState.markJobCompleted).toHaveBeenCalledWith(
      "airforce-video-1",
      "https://example.com/wan.mp4",
    );
    expect(mocks.pollVideoGeneration).not.toHaveBeenCalled();
    expect(mocks.setPrompt).toHaveBeenCalledWith("");
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
});
