import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toggleHistory = vi.fn();
const toggleQueue = vi.fn();
const toggleControls = vi.fn();

const studioState = {
  isHistoryOpen: false,
  isQueueOpen: false,
  isControlsOpen: false,
};

const imageStoreState = {
  jobs: [] as Array<{ id: string; status: string }>,
};

const videoStoreState = {
  jobs: [] as Array<{ id: string; status: string }>,
};

vi.mock("@/lib/store", () => ({
  useStudio: () => ({
    state: studioState,
    toggleHistory,
    toggleQueue,
    toggleControls,
  }),
}));

vi.mock("@/store/image-jobs", () => ({
  useImageJobsStore: (selector: (state: typeof imageStoreState) => unknown) => selector(imageStoreState),
}));

vi.mock("@/store/video-jobs", () => ({
  useVideoJobsStore: (selector: (state: typeof videoStoreState) => unknown) => selector(videoStoreState),
}));

vi.mock("../canvas", () => ({
  StudioCanvas: () => <div data-testid="canvas" />,
}));

vi.mock("../header", () => ({
  StudioHeader: () => <div data-testid="header" />,
}));

vi.mock("../prompt-composer", () => ({
  PromptComposer: () => <div data-testid="prompt-composer" />,
}));

vi.mock("../history-panel", () => ({
  HistoryPanel: () => <div data-testid="history-panel" />,
}));

vi.mock("../queue-panel", () => ({
  QueuePanel: () => <div data-testid="queue-panel" />,
}));

vi.mock("../generation-controls", () => ({
  GenerationControls: () => <div data-testid="generation-controls" />,
}));

vi.mock("../api-key-dialog", () => ({
  ApiKeyDialog: () => null,
}));

vi.mock("../image-viewer", () => ({
  ImageViewer: () => null,
}));

vi.mock("../generation-actions", () => ({
  GenerationActionsProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

import { StudioLayout } from "../layout";

describe("StudioLayout", () => {
  beforeEach(() => {
    toggleHistory.mockReset();
    toggleQueue.mockReset();
    toggleControls.mockReset();

    studioState.isHistoryOpen = false;
    studioState.isQueueOpen = false;
    studioState.isControlsOpen = false;

    imageStoreState.jobs = [
      { id: "image-1", status: "queued" },
      { id: "image-2", status: "generating" },
    ];
    videoStoreState.jobs = [
      { id: "video-1", status: "queued" },
      { id: "video-2", status: "completed" },
    ];

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("1024px"),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("shows a queue trigger badge with the active job count", () => {
    render(<StudioLayout />);

    expect(screen.getByRole("button", { name: /toggle queue/i })).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getAllByTestId("queue-panel")).toHaveLength(2);
  });

  it("toggles the queue when the trigger is pressed", async () => {
    const user = userEvent.setup();

    render(<StudioLayout />);

    await user.click(screen.getByRole("button", { name: /toggle queue/i }));

    expect(toggleQueue).toHaveBeenCalledTimes(1);
  });
});
