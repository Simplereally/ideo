import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VideoJob } from "@/lib/types";
import type { ImageJob } from "@/store/image-jobs";

const studioState = {
  isQueueOpen: true,
};

const selectImage = vi.fn();
const toggleQueue = vi.fn();
let isMobile = false;

const imageStoreState = {
  jobs: [] as ImageJob[],
  selectedJobId: null as string | null,
  selectJob: vi.fn(),
  cancelJobLocal: vi.fn(),
};

const videoStoreState = {
  jobs: [] as VideoJob[],
  selectedJobId: null as string | null,
  selectJob: vi.fn(),
  cancelJobLocal: vi.fn(),
};

function createImageJob(
  overrides: Partial<ImageJob> & Pick<ImageJob, "id" | "prompt" | "status">,
): ImageJob {
  return {
    id: overrides.id,
    prompt: overrides.prompt,
    model: "google:imagen-4.0-generate-001",
    provider: "google",
    aspectRatio: "1:1",
    payload: {
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

function createVideoJob(
  overrides: Partial<VideoJob> & Pick<VideoJob, "id" | "prompt" | "status">,
): VideoJob {
  return {
    id: overrides.id,
    prompt: overrides.prompt,
    model: "aiml:alibaba/wan2.1-t2v-plus",
    provider: "aiml",
    params: overrides.params ?? { prompt: overrides.prompt },
    status: overrides.status,
    createdAt: overrides.createdAt ?? Date.now() - 8_000,
    updatedAt: overrides.updatedAt ?? Date.now() - 8_000,
    requestPending: overrides.requestPending,
    resultUrl: overrides.resultUrl,
    error: overrides.error,
  };
}

vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get(_target, tag: string) {
        return ({ children, ...props }: Record<string, unknown>) => {
          const { initial, animate, exit, transition, layout, layoutId, ...domProps } = props;
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
  ScrollArea: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock("@/lib/store", () => ({
  useStudio: () => ({
    state: studioState,
    selectImage,
    toggleQueue,
  }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => isMobile,
}));

vi.mock("@/store/image-jobs", () => ({
  useImageJobsStore: (selector: (state: typeof imageStoreState) => unknown) => selector(imageStoreState),
}));

vi.mock("@/store/video-jobs", () => ({
  useVideoJobsStore: (selector: (state: typeof videoStoreState) => unknown) => selector(videoStoreState),
}));

vi.mock("@/lib/types", async () => {
  const actual = await vi.importActual<typeof import("@/lib/types")>("@/lib/types");
  return {
    ...actual,
    MODELS: [
      {
        id: "google:imagen-4.0-generate-001",
        value: "imagen-4.0-generate-001",
        label: "Imagen 4",
      },
      {
        id: "aiml:alibaba/wan2.1-t2v-plus",
        value: "alibaba/wan2.1-t2v-plus",
        label: "Wan 2.1 T2V+",
      },
    ],
    PROVIDER_SHORT_LABELS: {
      google: "Google",
      vertex: "Vertex",
      fal: "Fal",
      aiml: "AI/ML",
      airforce: "Airforce",
    },
  };
});

import { QueuePanel } from "../queue-panel";

describe("QueuePanel", () => {
  beforeEach(() => {
    isMobile = false;
    studioState.isQueueOpen = true;
    selectImage.mockReset();
    toggleQueue.mockReset();

    imageStoreState.jobs = [
      createImageJob({
        id: "image-generating",
        prompt: "Generating image prompt",
        status: "generating",
        attempts: 2,
      }),
      createImageJob({
        id: "image-completed",
        prompt: "Completed image prompt",
        status: "completed",
      }),
    ];
    imageStoreState.selectedJobId = null;
    imageStoreState.selectJob.mockReset();
    imageStoreState.cancelJobLocal.mockReset();

    videoStoreState.jobs = [
      createVideoJob({
        id: "video-queued",
        prompt: "Queued video prompt",
        status: "queued",
        requestPending: true,
      }),
      createVideoJob({
        id: "video-cancelled",
        prompt: "Cancelled video prompt",
        status: "cancelled",
      }),
    ];
    videoStoreState.selectedJobId = null;
    videoStoreState.selectJob.mockReset();
    videoStoreState.cancelJobLocal.mockReset();
  });

  it("renders only queued and generating jobs", () => {
    render(<QueuePanel overlay />);

    expect(screen.getByText("Generating image prompt")).toBeInTheDocument();
    expect(screen.getByText("Queued video prompt")).toBeInTheDocument();
    expect(screen.queryByText("Completed image prompt")).not.toBeInTheDocument();
    expect(screen.queryByText("Cancelled video prompt")).not.toBeInTheDocument();
    expect(screen.getAllByText("Generating").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Queued").length).toBeGreaterThan(0);
  });

  it("routes image selection through the correct stores", async () => {
    const user = userEvent.setup();

    render(<QueuePanel overlay />);

    await user.click(screen.getByRole("button", { name: /generating image prompt/i }));

    expect(selectImage).toHaveBeenCalledWith(null);
    expect(videoStoreState.selectJob).toHaveBeenCalledWith(null);
    expect(imageStoreState.selectJob).toHaveBeenCalledWith("image-generating");
  });

  it("routes video selection through the correct stores", async () => {
    const user = userEvent.setup();

    render(<QueuePanel overlay />);

    await user.click(screen.getByRole("button", { name: /queued video prompt/i }));

    expect(selectImage).toHaveBeenCalledWith(null);
    expect(imageStoreState.selectJob).toHaveBeenCalledWith(null);
    expect(videoStoreState.selectJob).toHaveBeenCalledWith("video-queued");
  });

  it("cancels queued jobs from the panel", async () => {
    const user = userEvent.setup();

    render(<QueuePanel overlay />);

    await user.click(screen.getByLabelText("Cancel video generation"));
    await user.click(screen.getByLabelText("Cancel image generation"));

    expect(videoStoreState.cancelJobLocal).toHaveBeenCalledWith("video-queued");
    expect(imageStoreState.cancelJobLocal).toHaveBeenCalledWith("image-generating");
  });

  it("closes the overlay after selecting on mobile", async () => {
    isMobile = true;
    const user = userEvent.setup();

    render(<QueuePanel overlay />);

    await user.click(screen.getByRole("button", { name: /queued video prompt/i }));

    expect(toggleQueue).toHaveBeenCalledTimes(1);
  });

  it("shows an empty state when there are no active jobs", () => {
    imageStoreState.jobs = [];
    videoStoreState.jobs = [];

    render(<QueuePanel overlay />);

    expect(screen.getByText("Queue is clear")).toBeInTheDocument();
    expect(
      screen.getByText("New generations stack here until they finish or fail."),
    ).toBeInTheDocument();
  });
});
