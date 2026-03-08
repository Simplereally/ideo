import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => {
      const {
        initial,
        animate,
        exit,
        transition,
        whileHover,
        whileTap,
        layout,
        layoutId,
        ...rest
      } = props;
      return <div {...rest}>{children}</div>;
    },
    button: ({ children, ...props }: any) => {
      const {
        initial,
        animate,
        exit,
        transition,
        whileHover,
        whileTap,
        layout,
        layoutId,
        ...rest
      } = props;
      return <button {...rest}>{children}</button>;
    },
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

const MOCK_VIDEO_JOBS = [
  {
    id: "video-1",
    prompt: "A neon koi fish swimming through clouds",
    model: "airforce:wan-2.6",
    provider: "airforce" as const,
    params: {
      prompt: "A neon koi fish swimming through clouds",
      duration: 5,
      aspectRatio: "9:16",
    },
    status: "queued" as const,
    createdAt: Date.now() - 5000,
    updatedAt: Date.now(),
  },
  {
    id: "video-2",
    prompt: "A completed video",
    model: "aiml:alibaba/wan-2-6-t2v",
    provider: "aiml" as const,
    params: {
      prompt: "A completed video",
    },
    status: "completed" as const,
    createdAt: Date.now() - 10000,
    updatedAt: Date.now(),
    resultUrl: "https://example.com/video.mp4",
  },
];

const mockVideoState = {
  jobs: MOCK_VIDEO_JOBS,
  cancelJobLocal: vi.fn(),
  selectJob: vi.fn(),
};

const selectorCalls: unknown[] = [];
const selectImage = vi.fn();

vi.mock("@/store/video-jobs", () => ({
  useVideoJobsStore: Object.assign(
    (selector?: (s: typeof mockVideoState) => unknown) => {
      if (selector) {
        const result = selector(mockVideoState);
        selectorCalls.push(result);
        return result;
      }
      return mockVideoState;
    },
    {
      subscribe: () => () => {},
      getState: () => mockVideoState,
    },
  ),
}));

vi.mock("@/lib/store", () => ({
  useStudio: () => ({
    selectImage,
  }),
}));

vi.mock("@/lib/types", async () => {
  const actual = await vi.importActual<typeof import("@/lib/types")>("@/lib/types");
  return {
    ...actual,
    MODELS: [
      {
        id: "airforce:wan-2.6",
        value: "wan-2.6",
        label: "Wan 2.6",
      },
      {
        id: "aiml:alibaba/wan-2-6-t2v",
        value: "alibaba/wan-2-6-t2v",
        label: "Wan 2.6 T2V",
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

import { PendingVideoJobsStrip } from "../pending-video-jobs-strip";

describe("PendingVideoJobsStrip", () => {
  beforeEach(() => {
    selectorCalls.length = 0;
    mockVideoState.cancelJobLocal.mockClear();
    mockVideoState.selectJob.mockClear();
    selectImage.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders active video jobs and hides completed ones", () => {
    render(<PendingVideoJobsStrip />);

    expect(screen.getByText(/neon koi fish/i)).toBeInTheDocument();
    expect(screen.queryByText(/completed video/i)).not.toBeInTheDocument();
  });

  it("selects the video job when its card is clicked", () => {
    render(<PendingVideoJobsStrip />);

    fireEvent.click(screen.getByRole("button", { name: /a neon koi fish swimming through clouds/i }));

    expect(selectImage).toHaveBeenCalledWith(null);
    expect(mockVideoState.selectJob).toHaveBeenCalledWith("video-1");
  });

  it("cancels the video job from the strip", () => {
    render(<PendingVideoJobsStrip />);

    fireEvent.click(screen.getByLabelText("Cancel video generation"));

    expect(mockVideoState.cancelJobLocal).toHaveBeenCalledWith("video-1");
  });

  it("selects the stable jobs array reference from the store", () => {
    render(<PendingVideoJobsStrip />);

    const arrayResults = selectorCalls.filter(Array.isArray);
    expect(arrayResults.length).toBeGreaterThan(0);
    for (const result of arrayResults) {
      expect(result).toBe(MOCK_VIDEO_JOBS);
    }
  });
});
