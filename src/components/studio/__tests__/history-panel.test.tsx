import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GeneratedImage, VideoJob } from "@/lib/types";
import type { ImageJob } from "@/store/image-jobs";

const retryImageJob = vi.fn();
const retryVideoJob = vi.fn();

type MockFn = ReturnType<typeof vi.fn>;

interface MockVideoStoreState {
  jobs: VideoJob[];
  selectedJobId: string | null;
  selectJob: MockFn;
  removeJob: MockFn;
  cancelJobLocal: MockFn;
  clearCompletedJobs: MockFn;
  clearTerminalJobs: MockFn;
}

interface MockImageStoreState {
  jobs: ImageJob[];
  cancelJobLocal: MockFn;
  removeJob: MockFn;
  clearTerminalJobs: MockFn;
}

interface MockStudioState {
  history: GeneratedImage[];
  selectedImage: GeneratedImage | null;
  isHistoryOpen: boolean;
}

const videoStoreState: MockVideoStoreState = {
  jobs: [],
  selectedJobId: null,
  selectJob: vi.fn(),
  removeJob: vi.fn(),
  cancelJobLocal: vi.fn(),
  clearCompletedJobs: vi.fn(),
  clearTerminalJobs: vi.fn(),
};

const imageStoreState: MockImageStoreState = {
  jobs: [],
  cancelJobLocal: vi.fn(),
  removeJob: vi.fn(),
  clearTerminalJobs: vi.fn(),
};

const studioState: MockStudioState = {
  history: [],
  selectedImage: null,
  isHistoryOpen: true,
};

const selectImage = vi.fn();
const removeImage = vi.fn();
const clearHistory = vi.fn();
const toggleHistory = vi.fn();
let isMobile = false;

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

vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get(_target, tag: string) {
        return ({ children, ...props }: Record<string, unknown>) => {
          const {
            initial,
            animate,
            exit,
            transition,
            layout,
            layoutId,
            ...domProps
          } = props;
          void initial;
          void animate;
          void exit;
          void transition;
          void layout;
          void layoutId;
          const React = require("react");
          return React.createElement(tag, domProps, children);
        };
      },
    },
  ),
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/store", () => ({
  useStudio: () => ({
    state: studioState,
    selectImage,
    removeImage,
    clearHistory,
    toggleHistory,
  }),
}));

vi.mock("@/store/video-jobs", () => ({
  useVideoJobsStore: (selector: (state: MockVideoStoreState) => unknown) =>
    selector(videoStoreState),
}));

vi.mock("@/store/image-jobs", () => ({
  useImageJobsStore: (selector: (state: MockImageStoreState) => unknown) =>
    selector(imageStoreState),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => isMobile,
}));

vi.mock("../generation-actions", () => ({
  useGenerationActions: () => ({
    generateFromCurrentState: vi.fn(),
    retryImageJob,
    retryVideoJob,
    isSubmittingVideo: false,
  }),
}));

import { HistoryPanel } from "../history-panel";

describe("HistoryPanel", () => {
  beforeEach(() => {
    isMobile = false;
    retryImageJob.mockReset();
    retryVideoJob.mockReset();

    videoStoreState.jobs = [
      createVideoJob({
        id: "video-error",
        prompt: "Failed video prompt",
        status: "error",
      }),
      createVideoJob({
        id: "video-complete",
        prompt: "Completed video prompt",
        status: "completed",
        resultUrl: "https://example.com/video.mp4",
        createdAt: Date.now() - 20_000,
        updatedAt: Date.now() - 20_000,
      }),
      createVideoJob({
        id: "video-active",
        prompt: "Active video prompt",
        status: "generating",
        createdAt: Date.now() - 15_000,
        updatedAt: Date.now() - 15_000,
      }),
    ];
    videoStoreState.selectedJobId = null;
    videoStoreState.selectJob.mockReset();
    videoStoreState.removeJob.mockReset();
    videoStoreState.cancelJobLocal.mockReset();
    videoStoreState.clearCompletedJobs.mockReset();
    videoStoreState.clearTerminalJobs.mockReset();

    imageStoreState.jobs = [
      createImageJob({
        id: "image-error",
        prompt: "Failed image prompt",
        status: "error",
      }),
      createImageJob({
        id: "image-active",
        prompt: "Active image prompt",
        status: "queued",
        createdAt: Date.now() - 8_000,
        updatedAt: Date.now() - 8_000,
      }),
    ];
    imageStoreState.cancelJobLocal.mockReset();
    imageStoreState.removeJob.mockReset();
    imageStoreState.clearTerminalJobs.mockReset();

    studioState.history = [
      createHistoryImage({
        id: "image-complete",
        prompt: "Completed history image",
      }),
    ];
    studioState.selectedImage = null;

    selectImage.mockReset();
    removeImage.mockReset();
    clearHistory.mockReset();
    toggleHistory.mockReset();
  });

  it("uses retry actions for failed image and video jobs", async () => {
    const user = userEvent.setup();

    render(<HistoryPanel overlay />);

    const imageRow = screen
      .getByText("Failed image prompt")
      .closest(".ios-list-item") as HTMLElement | null;
    const videoRow = screen
      .getByText("Failed video prompt")
      .closest(".ios-list-item") as HTMLElement | null;

    if (!imageRow || !videoRow) {
      throw new Error("Expected failed rows to render");
    }

    await user.click(
      within(imageRow).getAllByRole("button", {
        name: /retry failed image generation/i,
      })[0],
    );
    expect(retryImageJob).toHaveBeenCalledWith("image-error");

    await user.click(
      within(videoRow).getByRole("button", { name: /failed video prompt/i }),
    );
    await user.click(
      within(videoRow).getByRole("button", {
        name: /retry failed video generation/i,
      }),
    );
    expect(retryVideoJob).toHaveBeenCalledWith("video-error");
  });

  it("filters complete and failed items from the segmented controls", async () => {
    const user = userEvent.setup();

    render(<HistoryPanel overlay />);

    expect(screen.getByText("Completed history image")).toBeInTheDocument();
    expect(screen.getByText("Completed video prompt")).toBeInTheDocument();
    expect(screen.getByText("Failed image prompt")).toBeInTheDocument();
    expect(screen.getByText("Failed video prompt")).toBeInTheDocument();
    expect(screen.getByText("Active video prompt")).toBeInTheDocument();
    expect(screen.getByText("Active image prompt")).toBeInTheDocument();

    await user.click(
      screen.getByRole("radio", { name: /show complete history/i }),
    );

    expect(screen.getByText("Completed history image")).toBeInTheDocument();
    expect(screen.getByText("Completed video prompt")).toBeInTheDocument();
    expect(screen.queryByText("Failed image prompt")).not.toBeInTheDocument();
    expect(screen.queryByText("Failed video prompt")).not.toBeInTheDocument();
    expect(screen.queryByText("Active video prompt")).not.toBeInTheDocument();
    expect(screen.queryByText("Active image prompt")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("radio", { name: /show failures history/i }),
    );

    expect(screen.getByText("Failed image prompt")).toBeInTheDocument();
    expect(screen.getByText("Failed video prompt")).toBeInTheDocument();
    expect(screen.queryByText("Completed history image")).not.toBeInTheDocument();
    expect(screen.queryByText("Completed video prompt")).not.toBeInTheDocument();
    expect(screen.queryByText("Active video prompt")).not.toBeInTheDocument();
    expect(screen.queryByText("Active image prompt")).not.toBeInTheDocument();
  });

  it("clears saved images and terminal jobs across both stores", async () => {
    const user = userEvent.setup();

    render(<HistoryPanel overlay />);

    await user.click(screen.getByRole("button", { name: /clear all/i }));

    expect(clearHistory).toHaveBeenCalledTimes(1);
    expect(videoStoreState.clearTerminalJobs).toHaveBeenCalledTimes(1);
    expect(imageStoreState.clearTerminalJobs).toHaveBeenCalledTimes(1);
  });

  it("routes selection between saved images and video jobs without losing current behavior", async () => {
    const user = userEvent.setup();

    render(<HistoryPanel overlay />);

    await user.click(screen.getByRole("button", { name: /completed history image/i }));
    expect(videoStoreState.selectJob).toHaveBeenCalledWith(null);
    expect(selectImage).toHaveBeenCalledWith(
      expect.objectContaining({ id: "image-complete" }),
    );

    await user.click(screen.getByRole("button", { name: /active video prompt/i }));
    expect(selectImage).toHaveBeenCalledWith(null);
    expect(videoStoreState.selectJob).toHaveBeenCalledWith("video-active");
  });

  it("closes the overlay history panel after selecting a saved image on mobile", async () => {
    isMobile = true;
    const user = userEvent.setup();

    render(<HistoryPanel overlay />);

    await user.click(screen.getByRole("button", { name: /completed history image/i }));

    expect(selectImage).toHaveBeenCalledWith(
      expect.objectContaining({ id: "image-complete" }),
    );
    expect(toggleHistory).toHaveBeenCalledTimes(1);
  });

  it("does not close the history panel after selecting on non-mobile screens", async () => {
    const user = userEvent.setup();

    render(<HistoryPanel overlay />);

    await user.click(screen.getByRole("button", { name: /completed history image/i }));

    expect(selectImage).toHaveBeenCalledWith(
      expect.objectContaining({ id: "image-complete" }),
    );
    expect(toggleHistory).not.toHaveBeenCalled();
  });

  it("shows a filter-specific empty state when no items match", async () => {
    const user = userEvent.setup();

    videoStoreState.jobs = [
      createVideoJob({
        id: "video-active-only",
        prompt: "Only active video prompt",
        status: "generating",
      }),
    ];
    imageStoreState.jobs = [];
    studioState.history = [];

    render(<HistoryPanel overlay />);

    await user.click(
      screen.getByRole("radio", { name: /show failures history/i }),
    );

    expect(screen.getByText("No failures")).toBeInTheDocument();
    expect(
      screen.getByText("Failed or cancelled jobs will show up here."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Only active video prompt")).not.toBeInTheDocument();
  });

  it("exposes selected rows semantically for assistive technology", () => {
    studioState.selectedImage = studioState.history[0] ?? null;
    videoStoreState.selectedJobId = "video-active";

    render(<HistoryPanel overlay />);

    expect(
      screen.getByRole("button", { name: /completed history image/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: /active video prompt/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: /completed video prompt/i }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps row action buttons out of keyboard flow until the row is active", async () => {
    const user = userEvent.setup();

    render(<HistoryPanel overlay />);

    const imageRow = screen
      .getByText("Completed history image")
      .closest(".ios-list-item") as HTMLElement | null;

    if (!imageRow) {
      throw new Error("Expected saved image row to render");
    }

    expect(within(imageRow).getByTitle("Copy prompt")).toBeDisabled();

    await user.click(
      within(imageRow).getByRole("button", { name: /completed history image/i }),
    );

    expect(
      within(imageRow).getByRole("button", { name: /copy prompt/i }),
    ).not.toBeDisabled();
  });
});
