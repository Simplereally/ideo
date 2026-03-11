/**
 * PromptComposer — Character Limit Tests
 *
 * CONTRACT:
 *   The textarea enforces a **dynamic** max prompt length derived from the
 *   currently-selected model's `maxPromptLength` capability (falling back to
 *   DEFAULT_MAX_PROMPT_LENGTH = 4000 when the model doesn't specify one).
 *
 *   Invariants:
 *   1. Typing is allowed when under the limit.
 *   2. The character after the limit is blocked (hard stop).
 *   3. When at the limit WITH text selected, typing replaces the selection
 *      and stays within bounds.
 *   4. Pasting is allowed when it fits within the limit.
 *   5. Paste that would exceed the limit is truncated to fit.
 *   6. Paste with selected text accounts for the selection being replaced.
 *   7. Backspace/Delete always work, even at the limit.
 *   8. Cmd+A then type replaces the entire prompt.
 *   9. Switching models updates the enforced limit dynamically.
 *
 * TEST STRATEGY:
 *   We render PromptComposer inside a minimal StudioProvider-like wrapper
 *   that supplies the useStudio context.
 *   We test the textarea's keydown/paste handlers directly via fireEvent
 *   (for precise control over selection state and preventDefault assertions)
 *   and userEvent (for integrated typing flows).
 *   The mock model ID is configurable so we can test both default and
 *   model-specific limits (e.g. Wan models with maxPromptLength: 2000).
 */

import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// We need to mock modules that the component imports but that are irrelevant
// to character-limit behavior (API clients, framer-motion, etc.)
// ---------------------------------------------------------------------------

// Mock framer-motion to render plain elements
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...filterMotionProps(props)}>{children}</div>,
    p: ({ children, ...props }: any) => <p {...filterMotionProps(props)}>{children}</p>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Strip motion-specific props so React doesn't warn about unknown DOM attributes
function filterMotionProps(props: Record<string, unknown>) {
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
  return rest;
}

// Mock provider status hook — report at least one provider configured
vi.mock("@/hooks/use-provider-status", () => ({
  useProviderStatus: () => ({
    status: { google: true, vertex: false, fal: false, aiml: false },
    loading: false,
  }),
}));

// Mock video-jobs store
vi.mock("@/store/video-jobs", () => ({
  useVideoJobsStore: Object.assign(
    () => ({
      jobs: [],
      addJob: vi.fn(),
      setJobStatus: vi.fn(),
      markJobCompleted: vi.fn(),
      markJobError: vi.fn(),
    }),
    {
      subscribe: () => () => {},
      getState: () => ({ jobs: [] }),
    },
  ),
  getActiveJobs: () => [],
}));

// Mock image-jobs store
const imageJobsMockState = {
  jobs: [],
  addJob: vi.fn(),
  startJob: vi.fn(),
  markJobCompleted: vi.fn(),
  markJobError: vi.fn(),
  cancelJobLocal: vi.fn(),
  removeJob: vi.fn(),
  clearTerminalJobs: vi.fn(),
};
vi.mock("@/store/image-jobs", () => ({
  useImageJobsStore: Object.assign(
    (selector?: (s: typeof imageJobsMockState) => unknown) =>
      selector ? selector(imageJobsMockState) : imageJobsMockState,
    {
      subscribe: () => () => {},
      getState: () => imageJobsMockState,
    },
  ),
  getActiveImageJobs: () => [],
}));

// Mock services
vi.mock("@/lib/services/video-generation", () => ({
  createVideoGeneration: vi.fn(),
  getVideoGeneration: vi.fn(),
}));
vi.mock("@/lib/services/video-polling", () => ({
  pollVideoGeneration: vi.fn(),
}));

// Mock external API clients
vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn(),
}));
vi.mock("@fal-ai/client", () => ({
  fal: { config: vi.fn(), subscribe: vi.fn() },
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const mockUploadReferenceImage = vi.fn();

vi.mock("@/lib/services/reference-image-upload", () => ({
  uploadReferenceImage: (file: File) => mockUploadReferenceImage(file),
}));

vi.mock("./generation-actions", () => ({
  useGenerationActions: () => ({
    generateFromCurrentState: vi.fn(),
    retryVideoJob: vi.fn(),
    retryImageJob: vi.fn(),
    isSubmittingVideo: false,
  }),
}));

vi.mock("./model-combobox", () => ({
  ModelCombobox: () => <div data-testid="model-combobox" />,
}));

vi.mock("./aspect-ratio-combobox", () => ({
  AspectRatioCombobox: () => <div data-testid="aspect-ratio-combobox" />,
}));

vi.mock("./batch-size-popover", () => ({
  BatchSizePopover: () => <div data-testid="batch-size-popover" />,
}));

vi.mock("./pending-video-jobs-strip", () => ({
  PendingVideoJobsStrip: () => <div data-testid="pending-video-jobs-strip" />,
}));

// ---------------------------------------------------------------------------
// Minimal test wrapper that provides the useStudio context
// ---------------------------------------------------------------------------

// We import after mocks are set up
import { PromptComposer } from "./prompt-composer";
import { DEFAULT_MAX_PROMPT_LENGTH, getMaxPromptLength } from "@/lib/types";

// Create a thin wrapper that provides StudioContext with controllable prompt state.
// We mock `useStudio` at the module level for simplicity.

let mockPrompt = "";
let mockModel = "google:imagen-4.0-generate-001";
let mockSelectedImage: null | {
  id: string;
  prompt: string;
  imageUrl: string;
  aspectRatio: "1:1";
  model: string;
  provider: "google";
  createdAt: number;
} = null;
let mockUseSelectedImageAsVideoReference = false;
let mockVideoImageUrl = "";
let mockSetPrompt: (p: string) => void;
let mockSetUseSelectedImageAsVideoReference: (enabled: boolean) => void;
let mockSetVideoImageUrl: (url: string) => void;
const mockOpenApiKeyDialog = vi.fn();
const mockToggleControls = vi.fn();

vi.mock("@/lib/store", () => ({
  useStudio: () => ({
    state: {
      provider: "google" as const,
      prompt: mockPrompt,
      negativePrompt: "",
      aspectRatio: "1:1",
      model: mockModel,
      numberOfImages: 1,
      guidanceScale: 3.5,
      numInferenceSteps: 4,
      seed: "",
      safetyTolerance: 2,
      enableSafetyChecker: true,
      enhancePrompt: false,
      personGeneration: "ALLOW_ADULT",
      duration: 5,
      videoResolution: "720p",
      videoAspectRatio: "16:9",
      generateAudio: false,
      videoImageUrl: mockVideoImageUrl,
      videoAudioUrl: "",
      useSelectedImageAsVideoReference: mockUseSelectedImageAsVideoReference,
      videoShotType: "single",
      status: "idle",
      error: null,
      history: [],
      selectedImage: mockSelectedImage,
      isHistoryOpen: false,
      isControlsOpen: false,
      isApiKeyDialogOpen: false,
      isImageViewerOpen: false,
    },
    setPrompt: (p: string) => mockSetPrompt(p),
    startGeneration: vi.fn(),
    completeGeneration: vi.fn(),
    failGeneration: vi.fn(),
    openApiKeyDialog: mockOpenApiKeyDialog,
    toggleControls: mockToggleControls,
    setProvider: vi.fn(),
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
    setVideoImageUrl: (url: string) => mockSetVideoImageUrl(url),
    setVideoAudioUrl: vi.fn(),
    setUseSelectedImageAsVideoReference: (enabled: boolean) =>
      mockSetUseSelectedImageAsVideoReference(enabled),
    setVideoShotType: vi.fn(),
    selectImage: vi.fn(),
    removeImage: vi.fn(),
    clearHistory: vi.fn(),
    toggleHistory: vi.fn(),
    closeApiKeyDialog: vi.fn(),
    openImageViewer: vi.fn(),
    closeImageViewer: vi.fn(),
    resetStatus: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive the effective max from the currently-set mock model. */
function currentMax(): number {
  return getMaxPromptLength(mockModel);
}

function getTextarea(): HTMLTextAreaElement {
  return screen.getByPlaceholderText("Describe your vision...") as HTMLTextAreaElement;
}

/** Build a string of exactly `n` characters */
function chars(n: number, char = "a"): string {
  return char.repeat(n);
}

/**
 * Simulate a paste event on a textarea with the given clipboard text.
 * Optionally set selection range before pasting.
 */
function simulatePaste(
  textarea: HTMLTextAreaElement,
  text: string,
  selectionStart?: number,
  selectionEnd?: number,
) {
  if (selectionStart !== undefined && selectionEnd !== undefined) {
    textarea.selectionStart = selectionStart;
    textarea.selectionEnd = selectionEnd;
  }

  const pasteEvent = new Event("paste", { bubbles: true, cancelable: true }) as any;
  pasteEvent.clipboardData = {
    getData: () => text,
  };

  // fireEvent handles React's synthetic event system
  return fireEvent(textarea, pasteEvent);
}

function simulateImagePaste(textarea: HTMLTextAreaElement, file: File) {
  const pasteEvent = new Event("paste", { bubbles: true, cancelable: true }) as any;
  pasteEvent.clipboardData = {
    getData: () => "",
    items: [
      {
        type: file.type,
        getAsFile: () => file,
      },
    ],
  };

  return fireEvent(textarea, pasteEvent);
}

/**
 * Simulate a keydown event for a printable character on a textarea.
 * Optionally set selection range before the keydown.
 * Returns whether the event was NOT prevented (i.e., the key was allowed).
 */
function simulateKeyDown(
  textarea: HTMLTextAreaElement,
  key: string,
  selectionStart?: number,
  selectionEnd?: number,
  modifiers: { metaKey?: boolean; ctrlKey?: boolean } = {},
) {
  if (selectionStart !== undefined && selectionEnd !== undefined) {
    textarea.selectionStart = selectionStart;
    textarea.selectionEnd = selectionEnd;
  }

  // fireEvent.keyDown returns false if preventDefault was called
  const wasNotPrevented = fireEvent.keyDown(textarea, {
    key,
    ...modifiers,
  });
  return wasNotPrevented;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PromptComposer character limit", () => {
  beforeEach(() => {
    mockPrompt = "";
    mockModel = "google:imagen-4.0-generate-001";
    mockSelectedImage = null;
    mockUseSelectedImageAsVideoReference = false;
    mockVideoImageUrl = "";
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1280,
    });
    mockSetPrompt = vi.fn((p: string) => {
      mockPrompt = p;
    });
    mockSetUseSelectedImageAsVideoReference = vi.fn((enabled: boolean) => {
      mockUseSelectedImageAsVideoReference = enabled;
    });
    mockSetVideoImageUrl = vi.fn();
    mockUploadReferenceImage.mockReset();
    mockOpenApiKeyDialog.mockClear();
    mockToggleControls.mockClear();
  });

  it("renders the batch size control alongside the composer selectors", () => {
    render(<PromptComposer />);

    expect(screen.getByTestId("model-combobox")).toBeInTheDocument();
    expect(screen.getByTestId("aspect-ratio-combobox")).toBeInTheDocument();
    expect(screen.getByTestId("batch-size-popover")).toBeInTheDocument();
  });

  it("does not autofocus the composer textarea on mobile widths", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 390,
    });

    render(<PromptComposer />);

    expect(getTextarea()).not.toHaveFocus();
  });

  it("autofocuses the composer textarea on desktop widths", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1280,
    });

    render(<PromptComposer />);

    expect(getTextarea()).toHaveFocus();
  });

  it("shows a toggle for the selected history image when a video model supports references", () => {
    mockModel = "airforce:grok-imagine-video";
    mockSelectedImage = {
      id: "history-image-1",
      prompt: "History image prompt",
      imageUrl: "https://example.com/history.png",
      aspectRatio: "1:1",
      model: "google:imagen-4.0-generate-001",
      provider: "google",
      createdAt: Date.now(),
    };

    render(<PromptComposer />);

    expect(screen.getByLabelText("Use selected image as video reference")).toBeInTheDocument();
    expect(screen.getByText("Use Image")).toBeInTheDocument();
  });

  it("shows the active selected reference image in the composer", () => {
    mockModel = "airforce:grok-imagine-video";
    mockUseSelectedImageAsVideoReference = true;
    mockSelectedImage = {
      id: "history-image-2",
      prompt: "History image prompt",
      imageUrl: "https://example.com/history.png",
      aspectRatio: "1:1",
      model: "google:imagen-4.0-generate-001",
      provider: "google",
      createdAt: Date.now(),
    };

    render(<PromptComposer />);

    expect(screen.getByText("1 reference image ready")).toBeInTheDocument();
    expect(screen.getByText("Selected image")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /remove selected image/i })).toBeInTheDocument();
  });

  it("shows compact ratio and quality selectors for video models with those capabilities", () => {
    mockModel = "airforce:grok-imagine-video";

    render(<PromptComposer />);

    expect(screen.getByLabelText("Ratio: 16:9")).toBeInTheDocument();
    expect(screen.getByLabelText("Quality: 720p")).toBeInTheDocument();
  });

  it("disables generation until a pasted reference image is stored in state", async () => {
    mockModel = "airforce:grok-imagine-video";
    mockPrompt = "Make it cinematic";

    let resolveUpload!: (value: string) => void;
    const uploadPromise = new Promise<string>((resolve) => {
      resolveUpload = resolve;
    });
    mockUploadReferenceImage.mockReturnValueOnce(uploadPromise);

    const { rerender } = render(<PromptComposer />);
    const textarea = getTextarea();
    const generateButton = screen.getByRole("button", { name: /generate/i });
    const file = new File(["image-bytes"], "reference.png", { type: "image/png" });

    expect(generateButton).toBeEnabled();

    simulateImagePaste(textarea, file);

    await waitFor(() => expect(mockUploadReferenceImage).toHaveBeenCalledWith(file));
    await waitFor(() => expect(generateButton).toBeDisabled());

    await act(async () => {
      resolveUpload("https://example.com/pasted.png");
      await uploadPromise;
    });

    expect(mockSetVideoImageUrl).toHaveBeenCalledWith("https://example.com/pasted.png");
    expect(generateButton).toBeDisabled();

    mockVideoImageUrl = "https://example.com/pasted.png";
    rerender(<PromptComposer />);

    await waitFor(() => expect(generateButton).toBeEnabled());
  });

  it("re-enables generation when a pasted reference image upload fails", async () => {
    mockModel = "airforce:grok-imagine-video";
    mockPrompt = "Make it cinematic";

    let rejectUpload!: (reason?: unknown) => void;
    const uploadPromise = new Promise<string>((_, reject) => {
      rejectUpload = reject;
    });
    mockUploadReferenceImage.mockReturnValueOnce(uploadPromise);

    render(<PromptComposer />);
    const textarea = getTextarea();
    const generateButton = screen.getByRole("button", { name: /generate/i });
    const file = new File(["image-bytes"], "reference.png", { type: "image/png" });

    simulateImagePaste(textarea, file);

    await waitFor(() => expect(mockUploadReferenceImage).toHaveBeenCalledWith(file));
    await waitFor(() => expect(generateButton).toBeDisabled());

    await act(async () => {
      rejectUpload(new Error("Upload failed"));
      try {
        await uploadPromise;
      } catch {
        // Expected rejection for this test.
      }
    });

    await waitFor(() => expect(generateButton).toBeEnabled());

    expect(mockSetVideoImageUrl).not.toHaveBeenCalled();
  });

  // ---- 1. Basic typing under limit ----
  describe("basic typing under limit", () => {
    it("allows typing when prompt is under the limit", () => {
      mockPrompt = "hello";
      render(<PromptComposer />);
      const textarea = getTextarea();

      const allowed = simulateKeyDown(textarea, "x");
      expect(allowed).toBe(true);
    });

    it("allows typing when prompt is empty", () => {
      mockPrompt = "";
      render(<PromptComposer />);
      const textarea = getTextarea();

      const allowed = simulateKeyDown(textarea, "a");
      expect(allowed).toBe(true);
    });

    it("allows typing at one below the limit", () => {
      const max = currentMax();
      mockPrompt = chars(max - 1);
      render(<PromptComposer />);
      const textarea = getTextarea();

      const allowed = simulateKeyDown(textarea, "z");
      expect(allowed).toBe(true);
    });
  });

  // ---- 2. Hard stop at limit ----
  describe("hard stop at limit", () => {
    it("blocks the next character when at limit with no selection", () => {
      const max = currentMax();
      mockPrompt = chars(max);
      render(<PromptComposer />);
      const textarea = getTextarea();

      // No selection (cursor at end)
      textarea.selectionStart = max;
      textarea.selectionEnd = max;

      const allowed = simulateKeyDown(textarea, "x", max, max);
      expect(allowed).toBe(false);
    });

    it("blocks multiple different printable keys at limit", () => {
      const max = currentMax();
      mockPrompt = chars(max);
      render(<PromptComposer />);
      const textarea = getTextarea();

      for (const key of ["a", "1", " ", "!", "Z"]) {
        const allowed = simulateKeyDown(textarea, key, max, max);
        expect(allowed).toBe(false);
      }
    });
  });

  // ---- 3. Replace at limit (text selected) ----
  describe("replace at limit with selection", () => {
    it("allows typing when at limit with one character selected", () => {
      const max = currentMax();
      mockPrompt = chars(max);
      render(<PromptComposer />);
      const textarea = getTextarea();

      // Select one character — typing replaces it, result is still at max
      const allowed = simulateKeyDown(textarea, "x", 100, 101);
      expect(allowed).toBe(true);
    });

    it("allows typing when at limit with multiple characters selected", () => {
      const max = currentMax();
      mockPrompt = chars(max);
      render(<PromptComposer />);
      const textarea = getTextarea();

      // Select 10 characters — typing replaces them, result is max - 9
      const allowed = simulateKeyDown(textarea, "x", 100, 110);
      expect(allowed).toBe(true);
    });

    it("allows typing when at limit with entire prompt selected", () => {
      const max = currentMax();
      mockPrompt = chars(max);
      render(<PromptComposer />);
      const textarea = getTextarea();

      // Select all — typing replaces everything, result is 1
      const allowed = simulateKeyDown(textarea, "x", 0, max);
      expect(allowed).toBe(true);
    });
  });

  // ---- 4. Paste under limit ----
  describe("paste under limit", () => {
    it("allows paste when result fits within limit", () => {
      const max = currentMax();
      mockPrompt = chars(max - 10);
      render(<PromptComposer />);
      const textarea = getTextarea();

      // Paste 10 chars when 10 remain — should NOT be prevented
      const allowed = simulatePaste(textarea, chars(10), max - 10, max - 10);
      // When paste.length <= available, the handler does NOT preventDefault,
      // so the native paste proceeds and the onChange handler clamps.
      expect(allowed).toBe(true);
    });

    it("does not call setPrompt when paste fits (native paste handles it)", () => {
      mockPrompt = chars(100);
      render(<PromptComposer />);
      const textarea = getTextarea();

      simulatePaste(textarea, "hello", 100, 100);
      // The handler only calls setPrompt for truncation cases
      expect(mockSetPrompt).not.toHaveBeenCalled();
    });
  });

  // ---- 5. Paste truncated ----
  describe("paste truncated at limit", () => {
    it("truncates paste that would exceed the limit", () => {
      const max = currentMax();
      mockPrompt = chars(max - 10);
      render(<PromptComposer />);
      const textarea = getTextarea();

      // Paste 20 chars when only 10 remain
      simulatePaste(textarea, chars(20, "b"), max - 10, max - 10);

      expect(mockSetPrompt).toHaveBeenCalledTimes(1);
      const newValue = (mockSetPrompt as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(newValue.length).toBe(max);
      // The last 10 chars should be 'b' (truncated paste)
      expect(newValue.slice(max - 10)).toBe(chars(10, "b"));
    });

    it("truncates paste to zero chars when already at limit with no selection", () => {
      const max = currentMax();
      mockPrompt = chars(max);
      render(<PromptComposer />);
      const textarea = getTextarea();

      simulatePaste(textarea, "hello", max, max);

      expect(mockSetPrompt).toHaveBeenCalledTimes(1);
      const newValue = (mockSetPrompt as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(newValue.length).toBe(max);
    });
  });

  // ---- 6. Paste with selection ----
  describe("paste with selected text", () => {
    it("allows paste when selected text makes enough room (no truncation needed)", () => {
      const max = currentMax();
      mockPrompt = chars(max);
      render(<PromptComposer />);
      const textarea = getTextarea();

      // At max chars, select 20 chars (positions 100-120), paste 15 chars
      // Available = max - (max - 20) = 20, paste is 15. 15 > 20 is false.
      // Native paste handles it — no manual truncation needed.
      const allowed = simulatePaste(textarea, chars(15, "x"), 100, 120);
      expect(allowed).toBe(true);
      // setPrompt should NOT be called — native paste + onChange handles it
      expect(mockSetPrompt).not.toHaveBeenCalled();
    });

    it("truncates paste that exceeds available space even with selection", () => {
      const max = currentMax();
      mockPrompt = chars(max);
      render(<PromptComposer />);
      const textarea = getTextarea();

      // Select 10 chars, paste 50 chars. Available = 10, so 40 get truncated.
      simulatePaste(textarea, chars(50, "z"), 100, 110);

      expect(mockSetPrompt).toHaveBeenCalledTimes(1);
      const newValue = (mockSetPrompt as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(newValue.length).toBe(max);
      // The replaced section should be 10 'z' chars (truncated from 50)
      expect(newValue.slice(100, 110)).toBe(chars(10, "z"));
    });

    it("allows full paste when selection makes enough room", () => {
      const max = currentMax();
      mockPrompt = chars(max);
      render(<PromptComposer />);
      const textarea = getTextarea();

      // Select 100 chars (0-100), paste exactly 100 chars — fits perfectly
      // Available = max - (max - 100) = 100. paste.length === 100.
      // paste.length > available is false (100 > 100 is false), so native paste proceeds.
      const allowed = simulatePaste(textarea, chars(100, "y"), 0, 100);
      expect(allowed).toBe(true);
      // setPrompt should NOT be called — native paste handles it
      expect(mockSetPrompt).not.toHaveBeenCalled();
    });
  });

  // ---- 7. Backspace/Delete always work ----
  describe("backspace and delete always work", () => {
    it("allows Backspace at the limit", () => {
      const max = currentMax();
      mockPrompt = chars(max);
      render(<PromptComposer />);
      const textarea = getTextarea();

      const allowed = simulateKeyDown(textarea, "Backspace", max, max);
      // Backspace has key.length > 1, so it never enters the blocking branch
      expect(allowed).toBe(true);
    });

    it("allows Delete at the limit", () => {
      const max = currentMax();
      mockPrompt = chars(max);
      render(<PromptComposer />);
      const textarea = getTextarea();

      const allowed = simulateKeyDown(textarea, "Delete", max / 2, max / 2);
      expect(allowed).toBe(true);
    });

    it("allows arrow keys at the limit", () => {
      const max = currentMax();
      mockPrompt = chars(max);
      render(<PromptComposer />);
      const textarea = getTextarea();

      for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]) {
        const allowed = simulateKeyDown(textarea, key, max / 2, max / 2);
        expect(allowed).toBe(true);
      }
    });

    it("allows Escape at the limit", () => {
      const max = currentMax();
      mockPrompt = chars(max);
      render(<PromptComposer />);
      const textarea = getTextarea();

      const allowed = simulateKeyDown(textarea, "Escape", max / 2, max / 2);
      expect(allowed).toBe(true);
    });

    it("allows Tab at the limit", () => {
      const max = currentMax();
      mockPrompt = chars(max);
      render(<PromptComposer />);
      const textarea = getTextarea();

      const allowed = simulateKeyDown(textarea, "Tab", max / 2, max / 2);
      expect(allowed).toBe(true);
    });
  });

  // ---- 8. Cmd+A then type (select all and replace) ----
  describe("Cmd+A then type replaces everything", () => {
    it("allows Cmd+A at the limit (meta key bypasses block)", () => {
      const max = currentMax();
      mockPrompt = chars(max);
      render(<PromptComposer />);
      const textarea = getTextarea();

      const allowed = simulateKeyDown(textarea, "a", 0, max, { metaKey: true });
      expect(allowed).toBe(true);
    });

    it("allows Ctrl+A at the limit (ctrl key bypasses block)", () => {
      const max = currentMax();
      mockPrompt = chars(max);
      render(<PromptComposer />);
      const textarea = getTextarea();

      const allowed = simulateKeyDown(textarea, "a", 0, max, { ctrlKey: true });
      expect(allowed).toBe(true);
    });

    it("after select all, typing a character replaces the entire prompt", () => {
      const max = currentMax();
      mockPrompt = chars(max);
      render(<PromptComposer />);
      const textarea = getTextarea();

      // Simulate: all text is selected, user types 'x'
      // currentLength(max) - selectionLength(max) + 1 = 1 <= max → allowed
      const allowed = simulateKeyDown(textarea, "x", 0, max);
      expect(allowed).toBe(true);
    });
  });

  // ---- Edge cases ----
  describe("edge cases", () => {
    it("allows Cmd+C/Cmd+V shortcuts at the limit (meta key)", () => {
      const max = currentMax();
      mockPrompt = chars(max);
      render(<PromptComposer />);
      const textarea = getTextarea();

      const allowedC = simulateKeyDown(textarea, "c", 100, 200, { metaKey: true });
      const allowedV = simulateKeyDown(textarea, "v", 100, 200, { metaKey: true });
      const allowedX = simulateKeyDown(textarea, "x", 100, 200, { metaKey: true });
      expect(allowedC).toBe(true);
      expect(allowedV).toBe(true);
      expect(allowedX).toBe(true);
    });

    it("blocks typing at limit with zero-width selection (cursor, no selection)", () => {
      const max = currentMax();
      mockPrompt = chars(max);
      render(<PromptComposer />);
      const textarea = getTextarea();

      // Cursor in the middle, no selection
      const allowed = simulateKeyDown(textarea, "a", max / 2, max / 2);
      expect(allowed).toBe(false);
    });

    it("onChange handler clamps value to the model limit", () => {
      const max = currentMax();
      mockPrompt = chars(max - 1);
      render(<PromptComposer />);
      const textarea = getTextarea();

      // Simulate an onChange with a value exceeding the limit
      // (e.g., browser autocomplete injecting text)
      fireEvent.change(textarea, { target: { value: chars(max + 500) } });

      expect(mockSetPrompt).toHaveBeenCalledTimes(1);
      const newValue = (mockSetPrompt as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(newValue.length).toBe(max);
    });
  });

  // ---- 9. Dynamic model-based limits ----
  describe("dynamic model-based limits", () => {
    it("default model (Google Imagen) uses DEFAULT_MAX_PROMPT_LENGTH (4000)", () => {
      // Default mockModel is set to a Google model with no maxPromptLength
      expect(currentMax()).toBe(DEFAULT_MAX_PROMPT_LENGTH);
      expect(currentMax()).toBe(4000);
    });

    it("Wan model enforces a lower limit of 2000", () => {
      mockModel = "aiml:alibaba/wan2.2-t2i-plus";
      expect(currentMax()).toBe(2000);
    });

    it("blocks typing at 2000 for a Wan model", () => {
      mockModel = "aiml:alibaba/wan2.2-t2i-plus";
      mockPrompt = chars(2000);
      render(<PromptComposer />);
      const textarea = getTextarea();

      const allowed = simulateKeyDown(textarea, "x", 2000, 2000);
      expect(allowed).toBe(false);
    });

    it("allows typing at 1999 for a Wan model", () => {
      mockModel = "aiml:alibaba/wan2.2-t2i-plus";
      mockPrompt = chars(1999);
      render(<PromptComposer />);
      const textarea = getTextarea();

      const allowed = simulateKeyDown(textarea, "x");
      expect(allowed).toBe(true);
    });

    it("truncates paste to 2000 for a Wan model", () => {
      mockModel = "aiml:alibaba/wan2.2-t2i-plus";
      mockPrompt = chars(1990);
      render(<PromptComposer />);
      const textarea = getTextarea();

      // Paste 20 chars when only 10 remain (limit = 2000)
      simulatePaste(textarea, chars(20, "b"), 1990, 1990);

      expect(mockSetPrompt).toHaveBeenCalledTimes(1);
      const newValue = (mockSetPrompt as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(newValue.length).toBe(2000);
      expect(newValue.slice(1990)).toBe(chars(10, "b"));
    });

    it("onChange clamps to 2000 for a Wan model", () => {
      mockModel = "aiml:alibaba/wan-2-6-image";
      mockPrompt = chars(1999);
      render(<PromptComposer />);
      const textarea = getTextarea();

      fireEvent.change(textarea, { target: { value: chars(3000) } });

      expect(mockSetPrompt).toHaveBeenCalledTimes(1);
      const newValue = (mockSetPrompt as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(newValue.length).toBe(2000);
    });

    it("displays the correct counter for a 2000-limit model", () => {
      mockModel = "aiml:alibaba/wan2.2-t2i-plus";
      mockPrompt = "hello";
      render(<PromptComposer />);

      // Counter should show "5/2000"
      expect(screen.getByText("5/2000")).toBeInTheDocument();
    });

    it("displays the correct counter for a 4000-limit model", () => {
      mockModel = "google:imagen-4.0-generate-001";
      mockPrompt = "hello";
      render(<PromptComposer />);

      // Counter should show "5/4000"
      expect(screen.getByText("5/4000")).toBeInTheDocument();
    });

    it("Hailuo video model enforces 2000 limit", () => {
      mockModel = "aiml:minimax/hailuo-2.3";
      mockPrompt = chars(2000);
      render(<PromptComposer />);
      const textarea = getTextarea();

      const allowed = simulateKeyDown(textarea, "x", 2000, 2000);
      expect(allowed).toBe(false);
    });

    it("FLUX 2 Pro uses 4000 limit (same as default)", () => {
      mockModel = "aiml:blackforestlabs/flux-2-pro";
      expect(currentMax()).toBe(4000);

      mockPrompt = chars(4000);
      render(<PromptComposer />);
      const textarea = getTextarea();

      const allowed = simulateKeyDown(textarea, "x", 4000, 4000);
      expect(allowed).toBe(false);
    });

    it("unknown model falls back to DEFAULT_MAX_PROMPT_LENGTH", () => {
      mockModel = "unknown:nonexistent-model";
      expect(currentMax()).toBe(DEFAULT_MAX_PROMPT_LENGTH);
    });
  });
});
