import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GeneratedImage, VideoJob } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  openImageViewer: vi.fn(),
  selectJob: vi.fn(),
  retryVideoJob: vi.fn(),
}));

const selectedImage: GeneratedImage = {
  id: "img-1",
  imageUrl: "https://example.com/image.png",
  prompt: "A red flower",
  aspectRatio: "1:1",
  model: "google:imagen-4.0-generate-001",
  provider: "google",
  createdAt: Date.now(),
};

const studioState = {
  status: "idle" as const,
  selectedImage: selectedImage as GeneratedImage | null,
};

const videoStoreState = {
  selectedJobId: null as string | null,
  jobs: [] as VideoJob[],
  selectJob: mocks.selectJob,
};

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
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/lib/store", () => ({
  useStudio: () => ({
    state: studioState,
    openImageViewer: mocks.openImageViewer,
  }),
}));

vi.mock("@/store/video-jobs", () => ({
  useVideoJobsStore: (selector: (state: typeof videoStoreState) => unknown) =>
    selector(videoStoreState),
}));

vi.mock("../generation-actions", () => ({
  useGenerationActions: () => ({
    retryVideoJob: mocks.retryVideoJob,
    generateFromCurrentState: vi.fn(),
    retryImageJob: vi.fn(),
    isSubmittingVideo: false,
  }),
}));

import { StudioCanvas } from "../canvas";

describe("StudioCanvas image preview trigger", () => {
  beforeEach(() => {
    mocks.openImageViewer.mockReset();
    mocks.selectJob.mockReset();
  });

  it("opens only when clicking the image, not whitespace within the canvas trigger", async () => {
    render(<StudioCanvas />);
    const user = userEvent.setup();

    const trigger = screen.getByRole("button", { name: /open image preview/i });
    const image = screen.getByAltText(selectedImage.prompt);

    expect(trigger).not.toHaveClass("cursor-zoom-in");
    expect(image).toHaveClass("cursor-zoom-in");

    await user.click(trigger);
    expect(mocks.openImageViewer).not.toHaveBeenCalled();

    fireEvent.click(image);
    expect(mocks.openImageViewer).toHaveBeenCalledWith(selectedImage);

    trigger.focus();
    await user.keyboard("{Enter}");
    expect(mocks.openImageViewer).toHaveBeenCalledTimes(2);
  });
});

describe("StudioCanvas video error state", () => {
  const failedVideoJob: VideoJob = {
    id: "video-error-1",
    model: "aiml:alibaba/wan2.1-t2v-plus",
    provider: "aiml",
    prompt: "A failed video prompt",
    params: { prompt: "A failed video prompt" },
    status: "error",
    error: "Something went wrong",
    createdAt: Date.now() - 10_000,
    updatedAt: Date.now() - 10_000,
  };

  beforeEach(() => {
    mocks.selectJob.mockReset();
    mocks.retryVideoJob.mockReset();
    studioState.selectedImage = null;
    videoStoreState.selectedJobId = "video-error-1";
    videoStoreState.jobs = [failedVideoJob];
  });

  it("shows retry and dismiss buttons for failed video job", () => {
    render(<StudioCanvas />);

    expect(screen.getByText("Video generation failed")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dismiss/i })).toBeInTheDocument();
  });

  it("calls retryVideoJob when retry button is clicked", async () => {
    const user = userEvent.setup();

    render(<StudioCanvas />);

    await user.click(screen.getByRole("button", { name: /retry/i }));

    expect(mocks.retryVideoJob).toHaveBeenCalledWith("video-error-1");
  });

  it("deselects video job when dismiss button is clicked", async () => {
    const user = userEvent.setup();

    render(<StudioCanvas />);

    await user.click(screen.getByRole("button", { name: /dismiss/i }));

    expect(mocks.selectJob).toHaveBeenCalledWith(null);
  });

  it("shows error message when video job has no error text", () => {
    videoStoreState.jobs = [
      {
        ...failedVideoJob,
        error: undefined,
      },
    ];

    render(<StudioCanvas />);

    expect(screen.getByText("Video generation failed")).toBeInTheDocument();
    // Should not render an empty error message
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("retry button triggers generation with correct job id", async () => {
    const user = userEvent.setup();
    const jobIdToRetry = "video-error-1";

    render(<StudioCanvas />);

    await user.click(screen.getByRole("button", { name: /retry/i }));

    expect(mocks.retryVideoJob).toHaveBeenCalledTimes(1);
    expect(mocks.retryVideoJob).toHaveBeenCalledWith(jobIdToRetry);
  });

  it("displays retry button with RotateCcw icon for visual consistency", () => {
    render(<StudioCanvas />);

    const retryButton = screen.getByRole("button", { name: /retry/i });
    expect(retryButton).toBeInTheDocument();
    // The button should contain "Retry" text
    expect(retryButton).toHaveTextContent("Retry");
  });
});
