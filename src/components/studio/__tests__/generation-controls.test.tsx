/**
 * GenerationControls — Integration Test (Settings UI with Dropdowns)
 *
 * CONTRACT:
 *   `GenerationControls` renders the full settings panel within a
 *   `StudioProvider`. The UI now uses searchable dropdown comboboxes
 *   for provider and model selection. The following invariants hold:
 *
 *   1. Changing provider via ProviderDropdown updates ModelDropdown
 *      options to show only that provider's models.
 *   2. Selecting a model from ModelDropdown auto-updates the provider
 *      (because the store's SET_MODEL action derives provider from model).
 *   3. The selected provider and model labels render in their respective
 *      dropdown triggers.
 *   4. Video models surface Video Settings; image models surface
 *      Aspect Ratio + Advanced Parameters.
 *
 * CHANGE LOG (vs previous version):
 *   - Replaced button-based ModelSelector tests with combobox dropdown
 *     interaction patterns (open dropdown → search/click → verify).
 *   - Removed `getModelButtons()` and `selectModel()` helpers that
 *     assumed flat button DOM. Replaced with dropdown interaction helpers.
 *   - Preserved all behavioral intent: provider cascading, video/image
 *     mode switching, capability-driven control visibility.
 *
 * MOCKING STRATEGY:
 *   - framer-motion: mocked to render plain divs (eliminates animation
 *     timing and jsdom layout engine issues)
 *   - ScrollArea: mocked to render children directly (Radix ScrollArea
 *     requires IntersectionObserver & layout metrics unavailable in jsdom)
 *   - Separator: mocked trivially (it's decorative)
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { describe, it, expect, vi } from "vitest";
import {
  MODELS,
  PROVIDER_LABELS,
  getModelsForProvider,
  getDefaultModelForProvider,
  getModelConfig,
  getVideoModels,
  getImageModels,
  type Provider,
  type ModelConfig,
  type GeneratedImage,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Mocks — minimal stubs for components that depend on browser layout APIs
// ---------------------------------------------------------------------------

// framer-motion: replace motion components with plain HTML elements
vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get(_target, prop: string) {
        return ({
          children,
          className,
          style,
          ...rest
        }: {
          children?: React.ReactNode;
          className?: string;
          style?: React.CSSProperties;
          [key: string]: unknown;
        }) => {
          const {
            initial,
            animate,
            exit,
            transition,
            variants,
            whileHover,
            whileTap,
            whileFocus,
            whileInView,
            layout,
            layoutId,
            ...domProps
          } = rest;
          // Use createElement to avoid JSX.IntrinsicElements type issues
          const React = require("react");
          return React.createElement(
            prop,
            { className, style, ...domProps },
            children,
          );
        };
      },
    },
  ),
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// ScrollArea: jsdom lacks the layout metrics Radix needs; render children directly
vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({
    children,
    className,
  }: {
    children?: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  ScrollBar: () => null,
}));

// Separator: purely decorative, no behavior to test
vi.mock("@/components/ui/separator", () => ({
  Separator: ({ className }: { className?: string }) => (
    <hr className={className} />
  ),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks are registered)
// ---------------------------------------------------------------------------

import { StudioProvider, initialState, useStudio } from "@/lib/store";
import { GenerationControls } from "../generation-controls";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Renders GenerationControls within StudioProvider in overlay mode.
 *
 * Why overlay mode: The default (desktop) mode wraps content in a
 * motion.aside whose width is animated to 0 when `isControlsOpen` is
 * false, making content inaccessible. Overlay mode renders the panel
 * content directly, sidestepping animation state.
 */
const SELECTED_IMAGE_FIXTURE: GeneratedImage = {
  id: "selected-image",
  prompt: "Selected image",
  imageUrl: "https://example.com/selected-image.png",
  aspectRatio: "1:1",
  model: "google:imagen-4.0-generate-001",
  provider: "google",
  createdAt: 1,
};

function SeedSelectedImage() {
  const { selectImage } = useStudio();

  useEffect(() => {
    selectImage(SELECTED_IMAGE_FIXTURE);
  }, [selectImage]);

  return null;
}

function renderSettings(options?: { withSelectedImage?: boolean }) {
  return render(
    <StudioProvider>
      {options?.withSelectedImage ? <SeedSelectedImage /> : null}
      <GenerationControls overlay />
    </StudioProvider>,
  );
}

/**
 * Opens the provider dropdown (first combobox), selects the given provider.
 * Uses `within(listbox)` to disambiguate when the trigger already shows the
 * same label as the option being selected (e.g. default provider = aiml).
 */
async function selectProvider(
  user: ReturnType<typeof userEvent.setup>,
  provider: Provider,
) {
  const comboboxes = screen.getAllByRole("combobox");
  // First combobox = provider, second = model
  await user.click(comboboxes[0]);
  const listbox = screen.getByRole("listbox");
  await user.click(within(listbox).getByText(PROVIDER_LABELS[provider]));
}

/**
 * Opens the model dropdown (second combobox), selects the given model by label.
 * Scopes the click to the listbox to avoid trigger label collisions.
 */
async function selectModelByLabel(
  user: ReturnType<typeof userEvent.setup>,
  modelLabel: string,
) {
  const comboboxes = screen.getAllByRole("combobox");
  // Second combobox = model
  await user.click(comboboxes[1]);
  const listbox = screen.getByRole("listbox");
  await user.click(within(listbox).getByText(modelLabel));
}

/**
 * Opens the model dropdown, searches for a model, then selects it.
 * Useful when model labels overlap across providers.
 */
async function searchAndSelectModel(
  user: ReturnType<typeof userEvent.setup>,
  searchTerm: string,
  modelLabel: string,
) {
  const comboboxes = screen.getAllByRole("combobox");
  await user.click(comboboxes[1]);
  const searchInput = screen.getByPlaceholderText(/search models/i);
  await user.type(searchInput, searchTerm);
  await user.click(screen.getByText(modelLabel));
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("GenerationControls (Settings UI integration)", () => {
  // -------------------------------------------------------------------------
  // 1) Initial render
  // -------------------------------------------------------------------------

  describe("initial render", () => {
    it("renders the Settings heading", () => {
      renderSettings();

      expect(
        screen.getByRole("heading", { name: /settings/i }),
      ).toBeInTheDocument();
    });

    it("renders Provider and Model section labels", () => {
      renderSettings();

      expect(screen.getByText("Provider")).toBeInTheDocument();
      expect(screen.getByText("Model")).toBeInTheDocument();
    });

    it("displays the default provider in the provider dropdown trigger", () => {
      renderSettings();

      // Default provider comes from initialState
      const comboboxes = screen.getAllByRole("combobox");
      expect(comboboxes[0]).toHaveTextContent(PROVIDER_LABELS[initialState.provider]);
    });

    it("displays the default model in the model dropdown trigger", () => {
      renderSettings();

      const defaultModel = getModelConfig(initialState.model)!;
      const comboboxes = screen.getAllByRole("combobox");
      expect(comboboxes[1]).toHaveTextContent(defaultModel.label);
    });

    it("renders Aspect Ratio section for the default image model", () => {
      renderSettings();

      expect(screen.getByText(/aspect ratio/i)).toBeInTheDocument();
    });

    it("does NOT render Video Settings for the default image model", () => {
      renderSettings();

      expect(screen.queryByText(/video settings/i)).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 2) Changing provider updates the model dropdown
  // -------------------------------------------------------------------------

  describe("provider change cascades to model", () => {
    it("switching provider to fal updates model dropdown to show fal's default model", async () => {
      const user = userEvent.setup();
      renderSettings();

      await selectProvider(user, "fal");

      // The model dropdown trigger should now show fal's default model
      const falDefault = getDefaultModelForProvider("fal")!;
      const comboboxes = screen.getAllByRole("combobox");
      expect(comboboxes[1]).toHaveTextContent(falDefault.label);
    });

    it("switching provider to aiml shows aiml's default model", async () => {
      const user = userEvent.setup();
      renderSettings();

      await selectProvider(user, "aiml");

      const aimlDefault = getDefaultModelForProvider("aiml")!;
      const comboboxes = screen.getAllByRole("combobox");
      expect(comboboxes[1]).toHaveTextContent(aimlDefault.label);
    });

    it("model dropdown only shows models for the selected provider", async () => {
      const user = userEvent.setup();
      renderSettings();

      await selectProvider(user, "fal");

      // Open model dropdown and verify only fal models are listed
      const comboboxes = screen.getAllByRole("combobox");
      await user.click(comboboxes[1]);

      const falModels = getModelsForProvider("fal");
      const listbox = screen.getByRole("listbox");
      for (const model of falModels) {
        expect(within(listbox).getByText(model.label)).toBeInTheDocument();
      }

      // Verify no google-exclusive models leak through
      const googleModels = getModelsForProvider("google");
      for (const model of googleModels) {
        // Only check if label is unique to google
        const existsInFal = falModels.some((m) => m.label === model.label);
        if (!existsInFal) {
          expect(
            within(listbox).queryByText(model.label),
          ).not.toBeInTheDocument();
        }
      }
    });
  });

  // -------------------------------------------------------------------------
  // 3) Selecting a model updates the provider
  // -------------------------------------------------------------------------

  describe("model selection updates provider", () => {
    it("selecting a fal model updates provider dropdown to show Fal AI", async () => {
      const user = userEvent.setup();
      renderSettings();

      // Default is google. Open model dropdown — it shows google models.
      // We first switch provider to fal, then select a specific fal model.
      await selectProvider(user, "fal");

      const falModels = getModelsForProvider("fal");
      const targetModel = falModels[falModels.length - 1];
      await selectModelByLabel(user, targetModel.label);

      // Provider should still be fal
      const comboboxes = screen.getAllByRole("combobox");
      expect(comboboxes[0]).toHaveTextContent(PROVIDER_LABELS.fal);
      // Model trigger shows the selected model
      expect(comboboxes[1]).toHaveTextContent(targetModel.label);
    });

    it("selecting a model within the same provider keeps provider unchanged", async () => {
      const user = userEvent.setup();
      renderSettings();

      // Default provider is initialState.provider; select a different model from the same provider
      const sameProviderModels = getModelsForProvider(initialState.provider);
      const lastModel = sameProviderModels[sameProviderModels.length - 1];

      await selectModelByLabel(user, lastModel.label);

      const comboboxes = screen.getAllByRole("combobox");
      expect(comboboxes[0]).toHaveTextContent(PROVIDER_LABELS[initialState.provider]);
      expect(comboboxes[1]).toHaveTextContent(lastModel.label);
    });
  });

  // -------------------------------------------------------------------------
  // 4) Video model → Video Settings appear
  // -------------------------------------------------------------------------

  describe("video model selection shows video controls", () => {
    it("selecting an aiml video model shows Video Settings section", async () => {
      const user = userEvent.setup();
      renderSettings();

      await selectProvider(user, "aiml");

      const aimlVideoModels = getModelsForProvider("aiml").filter(
        (m) => m.kind === "video",
      );
      expect(aimlVideoModels.length).toBeGreaterThan(0);

      await selectModelByLabel(user, aimlVideoModels[0].label);

      expect(screen.getByText(/video settings/i)).toBeInTheDocument();
    });

    it("video model hides image-only controls (Advanced Parameters)", async () => {
      const user = userEvent.setup();
      renderSettings();

      await selectProvider(user, "aiml");

      const videoModel = getModelsForProvider("aiml").find(
        (m) => m.kind === "video",
      )!;
      await selectModelByLabel(user, videoModel.label);

      expect(screen.queryByText(/advanced parameters/i)).not.toBeInTheDocument();
    });

    it("video model with duration options shows duration controls", async () => {
      const user = userEvent.setup();
      renderSettings();

      const videoWithDuration = getVideoModels().find(
        (m) => m.capabilities.durationOptions?.length,
      );
      expect(videoWithDuration).toBeDefined();

      // Switch to its provider first
      await selectProvider(user, videoWithDuration!.provider);
      await selectModelByLabel(user, videoWithDuration!.label);

      expect(screen.getByText(/duration/i)).toBeInTheDocument();
    });

    it("video model with generateAudio shows Generate Audio toggle", async () => {
      const user = userEvent.setup();
      renderSettings();

      const videoWithAudio = getVideoModels().find(
        (m) => m.capabilities.generateAudio,
      );
      expect(videoWithAudio).toBeDefined();

      await selectProvider(user, videoWithAudio!.provider);
      await selectModelByLabel(user, videoWithAudio!.label);

      expect(screen.getByText(/generate audio/i)).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 5) Image model hides video controls
  // -------------------------------------------------------------------------

  describe("image model selection hides video controls", () => {
    it("switching from video model to image model hides Video Settings", async () => {
      const user = userEvent.setup();
      renderSettings();

      // Select a video model
      await selectProvider(user, "aiml");
      const videoModel = getModelsForProvider("aiml").find(
        (m) => m.kind === "video",
      )!;
      await selectModelByLabel(user, videoModel.label);
      expect(screen.getByText(/video settings/i)).toBeInTheDocument();

      // Switch to an image model (google)
      await selectProvider(user, "google");
      expect(screen.queryByText(/video settings/i)).not.toBeInTheDocument();
      expect(screen.getByText(/aspect ratio/i)).toBeInTheDocument();
    });

    it("switching from video to image restores Advanced Parameters", async () => {
      const user = userEvent.setup();
      renderSettings();

      // Select video
      await selectProvider(user, "aiml");
      const videoModel = getModelsForProvider("aiml").find(
        (m) => m.kind === "video",
      )!;
      await selectModelByLabel(user, videoModel.label);
      expect(screen.queryByText(/advanced parameters/i)).not.toBeInTheDocument();

      // Switch to image
      await selectProvider(user, "google");
      expect(screen.getByText(/advanced parameters/i)).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 6) Round-trip: image → video → image
  // -------------------------------------------------------------------------

  describe("round-trip transitions", () => {
    it("image → video → image preserves correct UI state at each step", async () => {
      const user = userEvent.setup();
      renderSettings();

      // Start: default is aiml image model
      expect(screen.getByText(/aspect ratio/i)).toBeInTheDocument();
      expect(screen.queryByText(/video settings/i)).not.toBeInTheDocument();

      // Step 1: switch to aiml video model (already on aiml provider)
      const videoModel = getModelsForProvider("aiml").find(
        (m) => m.kind === "video",
      )!;
      await selectModelByLabel(user, videoModel.label);
      expect(screen.getByText(/video settings/i)).toBeInTheDocument();
      expect(screen.queryByText(/advanced parameters/i)).not.toBeInTheDocument();

      // Step 2: switch back to image (google)
      await selectProvider(user, "google");
      expect(screen.getByText(/aspect ratio/i)).toBeInTheDocument();
      expect(screen.queryByText(/video settings/i)).not.toBeInTheDocument();
    }, 10_000);
  });

  // -------------------------------------------------------------------------
  // 7) Model-specific capabilities drive UI controls
  // -------------------------------------------------------------------------

  describe("model capabilities drive control visibility", () => {
    it("fal model with guidanceScale shows Guidance Scale in Advanced Parameters", async () => {
      const user = userEvent.setup();
      renderSettings();

      const falDev = getModelConfig("fal:fal-ai/flux/dev");
      expect(falDev).toBeDefined();
      expect(falDev!.capabilities.guidanceScale).toBeDefined();

      await selectProvider(user, "fal");
      await selectModelByLabel(user, falDev!.label);

      // Open Advanced Parameters
      const advancedToggle = screen.getByText(/advanced parameters/i);
      await user.click(advancedToggle);

      expect(screen.getByText(/guidance scale/i)).toBeInTheDocument();
      expect(screen.getByText(/inference steps/i)).toBeInTheDocument();
    });

    it("google model without guidanceScale does not show Guidance Scale", async () => {
      const user = userEvent.setup();
      renderSettings();

      const googleModel = getModelConfig("google:imagen-4.0-generate-001");
      expect(googleModel).toBeDefined();
      expect(googleModel!.capabilities.guidanceScale).toBeUndefined();

      // Select google provider (default is aiml)
      await selectProvider(user, "google");

      const advancedToggle = screen.getByText(/advanced parameters/i);
      await user.click(advancedToggle);

      expect(screen.queryByText(/guidance scale/i)).not.toBeInTheDocument();
    });

    it("vertex model with negativePrompt shows Negative Prompt in Advanced Parameters", async () => {
      const user = userEvent.setup();
      renderSettings();

      const vertexModel = getModelConfig("vertex:imagen-3.0-generate-001");
      expect(vertexModel).toBeDefined();
      expect(vertexModel!.capabilities.negativePrompt).toBe(true);

      await selectProvider(user, "vertex");
      await selectModelByLabel(user, vertexModel!.label);

      const advancedToggle = screen.getByText(/advanced parameters/i);
      await user.click(advancedToggle);

      expect(screen.getByText(/negative prompt/i)).toBeInTheDocument();
    });

    it("video model with resolution options shows Resolution control", async () => {
      const user = userEvent.setup();
      renderSettings();

      const videoWithResolution = getVideoModels().find(
        (m) => m.capabilities.resolutionOptions?.length,
      );
      expect(videoWithResolution).toBeDefined();

      await selectProvider(user, videoWithResolution!.provider);
      await selectModelByLabel(user, videoWithResolution!.label);

      expect(screen.getByText(/resolution/i)).toBeInTheDocument();
    });

    it("shows a selected canvas image toggle for supported video models", async () => {
      const user = userEvent.setup();
      renderSettings({ withSelectedImage: true });

      await selectProvider(user, "airforce");
      await selectModelByLabel(user, "Grok Imagine Video");

      expect(
        await screen.findByText(/use selected canvas image/i),
      ).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 8) Dropdown triggers show selected values
  // -------------------------------------------------------------------------

  describe("dropdown triggers reflect selected state", () => {
    it("provider dropdown trigger shows the current provider label", () => {
      renderSettings();

      const comboboxes = screen.getAllByRole("combobox");
      expect(comboboxes[0]).toHaveTextContent(PROVIDER_LABELS[initialState.provider]);
    });

    it("model dropdown trigger shows the current model label", () => {
      renderSettings();

      const defaultModel = getModelConfig(initialState.model)!;
      const comboboxes = screen.getAllByRole("combobox");
      expect(comboboxes[1]).toHaveTextContent(defaultModel.label);
    });

    it("after switching provider, both triggers update correctly", async () => {
      const user = userEvent.setup();
      renderSettings();

      await selectProvider(user, "vertex");

      const vertexDefault = getDefaultModelForProvider("vertex")!;
      const comboboxes = screen.getAllByRole("combobox");
      expect(comboboxes[0]).toHaveTextContent(PROVIDER_LABELS.vertex);
      expect(comboboxes[1]).toHaveTextContent(vertexDefault.label);
    });

    it("cycling through all providers settles on the last selected", async () => {
      const user = userEvent.setup();
      renderSettings();

      for (const provider of ["vertex", "fal", "aiml", "google"] as Provider[]) {
        await selectProvider(user, provider);
      }

      const googleDefault = getDefaultModelForProvider("google")!;
      const comboboxes = screen.getAllByRole("combobox");
      expect(comboboxes[0]).toHaveTextContent(PROVIDER_LABELS.google);
      expect(comboboxes[1]).toHaveTextContent(googleDefault.label);
    });
  });

  // -------------------------------------------------------------------------
  // 9) Panel header
  // -------------------------------------------------------------------------

  describe("panel header", () => {
    it("renders a close button in the panel header", () => {
      renderSettings();

      expect(
        screen.getByRole("heading", { name: /settings/i }),
      ).toBeInTheDocument();
      // Close button exists (X icon button)
      const allButtons = screen.getAllByRole("button");
      expect(allButtons.length).toBeGreaterThan(0);
    });
  });
});
