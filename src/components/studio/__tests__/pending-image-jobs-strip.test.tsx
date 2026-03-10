/**
 * PendingImageJobsStrip — Regression Test
 *
 * Guards against the runtime console error:
 *   "The result of getServerSnapshot should be cached to avoid an infinite loop"
 *
 * Root cause: Zustand's `useSyncExternalStore` calls getServerSnapshot during
 * hydration. If the selector returns a new array reference every call (via
 * `.filter()`), React detects an unstable snapshot and throws.
 *
 * The fix: select the stable `s.jobs` reference from the store and derive
 * `activeJobs` via `useMemo`.
 */

import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock framer-motion to render plain elements
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
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Build a minimal mock store that mimics Zustand's selector-based hook.
// The key property: `jobs` is a *stable* array reference, and the selector
// is called with the full state object (like real Zustand).
const MOCK_JOBS = [
  {
    id: "job-1",
    prompt: "A scenic mountain landscape",
    model: "google:imagen-3",
    provider: "google" as const,
    aspectRatio: "1:1" as const,
    payload: {
      prompt: "A scenic mountain landscape",
      model: "google:imagen-3",
      provider: "google" as const,
      aspectRatio: "1:1" as const,
    },
    status: "generating" as const,
    attempts: 1,
    createdAt: Date.now() - 5000,
    updatedAt: Date.now(),
  },
  {
    id: "job-2",
    prompt: "A completed job",
    model: "google:imagen-3",
    provider: "google" as const,
    aspectRatio: "1:1" as const,
    payload: {
      prompt: "A completed job",
      model: "google:imagen-3",
      provider: "google" as const,
      aspectRatio: "1:1" as const,
    },
    status: "completed" as const,
    attempts: 1,
    createdAt: Date.now() - 10000,
    updatedAt: Date.now(),
    resultUrl: "https://example.com/image.png",
  },
];

const mockState = {
  jobs: MOCK_JOBS,
  selectedJobId: null,
  addJob: vi.fn(),
  startJob: vi.fn(),
  markJobCompleted: vi.fn(),
  markJobError: vi.fn(),
  cancelJobLocal: vi.fn(),
  removeJob: vi.fn(),
  clearTerminalJobs: vi.fn(),
  selectJob: vi.fn(),
};

// Track every selector call to verify the component selects s.jobs (stable)
// rather than calling s.jobs.filter() (unstable).
const selectorCalls: unknown[] = [];

vi.mock("@/store/image-jobs", () => ({
  useImageJobsStore: Object.assign(
    (selector?: (s: typeof mockState) => unknown) => {
      if (selector) {
        const result = selector(mockState);
        selectorCalls.push(result);
        return result;
      }
      return mockState;
    },
    {
      subscribe: () => () => {},
      getState: () => mockState,
    },
  ),
}));

// Mock video jobs store
const mockVideoState = {
  jobs: [],
  selectedJobId: null,
  selectJob: vi.fn(),
};

vi.mock("@/store/video-jobs", () => ({
  useVideoJobsStore: (selector?: (s: typeof mockVideoState) => unknown) => {
    if (selector) {
      return selector(mockVideoState);
    }
    return mockVideoState;
  },
}));

// Mock studio store
vi.mock("@/lib/store", () => ({
  useStudio: () => ({
    selectImage: vi.fn(),
  }),
}));

// Mock types with minimal definitions
vi.mock("@/lib/types", () => ({
  MODELS: [],
  PROVIDER_SHORT_LABELS: {
    google: "Google",
    vertex: "Vertex",
    fal: "fal",
    aiml: "AI/ML",
  },
}));

// ---------------------------------------------------------------------------
// Import component under test AFTER mocks
// ---------------------------------------------------------------------------
// eslint-disable-next-line import/first
import { PendingImageJobsStrip } from "../pending-image-jobs-strip";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PendingImageJobsStrip", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    selectorCalls.length = 0;
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    cleanup();
  });

  it("renders active jobs without triggering getServerSnapshot warning", () => {
    render(<PendingImageJobsStrip />);

    // The generating job should be rendered
    expect(screen.getByText(/scenic mountain/i)).toBeInTheDocument();

    // The completed job should NOT appear (filtered out)
    expect(screen.queryByText(/completed job/i)).not.toBeInTheDocument();

    // Assert no console.error about getServerSnapshot
    const snapshotErrors = consoleErrorSpy.mock.calls.filter((args: unknown[]) =>
      args.some(
        (arg: unknown) =>
          typeof arg === "string" &&
          arg.includes("getServerSnapshot"),
      ),
    );
    expect(snapshotErrors).toHaveLength(0);
  });

  it("jobs selector returns a stable reference (not a derived array)", () => {
    // The component calls useImageJobsStore((s) => s.jobs) — which should
    // return the same array reference on every call (the stable `jobs` array
    // from the store). If someone regresses to .filter() inside the selector,
    // every call would produce a new array reference.
    render(<PendingImageJobsStrip />);

    // Find all selector results that are arrays (the jobs selector).
    // The cancelJobLocal selector returns a function, so filter those out.
    const arrayResults = selectorCalls.filter(Array.isArray);

    // All array results must be the same reference (referential equality).
    // With the fixed selector `(s) => s.jobs`, every call returns MOCK_JOBS.
    // A broken selector `(s) => s.jobs.filter(...)` would return new arrays.
    expect(arrayResults.length).toBeGreaterThan(0);
    for (const result of arrayResults) {
      expect(result).toBe(MOCK_JOBS);
    }
  });
});
