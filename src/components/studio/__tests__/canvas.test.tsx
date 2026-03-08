import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GeneratedImage } from "@/lib/types";

const openImageViewer = vi.fn();
const selectJob = vi.fn();

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
  selectedImage,
};

const videoStoreState = {
  selectedJobId: null as string | null,
  jobs: [] as Array<Record<string, unknown>>,
  selectJob,
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
    openImageViewer,
  }),
}));

vi.mock("@/store/video-jobs", () => ({
  useVideoJobsStore: (selector: (state: typeof videoStoreState) => unknown) =>
    selector(videoStoreState),
}));

import { StudioCanvas } from "../canvas";

describe("StudioCanvas image preview trigger", () => {
  beforeEach(() => {
    openImageViewer.mockReset();
    selectJob.mockReset();
  });

  it("opens only when clicking the image, not whitespace within the canvas trigger", async () => {
    render(<StudioCanvas />);
    const user = userEvent.setup();

    const trigger = screen.getByRole("button", { name: /open image preview/i });
    const image = screen.getByAltText(selectedImage.prompt);

    expect(trigger).not.toHaveClass("cursor-zoom-in");
    expect(image).toHaveClass("cursor-zoom-in");

    await user.click(trigger);
    expect(openImageViewer).not.toHaveBeenCalled();

    fireEvent.click(image);
    expect(openImageViewer).toHaveBeenCalledWith(selectedImage);

    trigger.focus();
    await user.keyboard("{Enter}");
    expect(openImageViewer).toHaveBeenCalledTimes(2);
  });
});
