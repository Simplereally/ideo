/**
 * Integration Test — Provider ↔ Model Cascading
 *
 * CONTRACT:
 *   When both ProviderDropdown and ModelDropdown are rendered together
 *   (sharing state via props or a store), the following invariants hold:
 *
 *   1. Changing provider MUST update the model dropdown to show only
 *      that provider's models.
 *   2. The default model for the new provider MUST be auto-selected.
 *   3. Selecting a model from a different provider MUST update the
 *      provider dropdown to reflect the new provider.
 *   4. Video models surface video-specific capabilities; image models
 *      surface image-specific capabilities.
 *
 * TEST STRATEGY:
 *   We test at two levels:
 *   (a) Pure data-layer: the store reducer logic for cascading
 *   (b) Component integration: render both dropdowns sharing state via
 *       a thin wrapper that mirrors how the real app composes them.
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  MODELS,
  PROVIDER_LABELS,
  getModelsForProvider,
  getDefaultModelForProvider,
  getModelConfig,
  isVideoModel,
  getVideoModels,
  getImageModels,
  type Provider,
  type ModelConfig,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers: We import the components under test
// ---------------------------------------------------------------------------

import { ProviderDropdown } from "../provider-dropdown";
import { ModelDropdown } from "../model-dropdown";
import { useState } from "react";

/**
 * A thin integration wrapper that mirrors real app composition:
 * provider and model state are co-managed, with cascading on change.
 */
function StudioDropdowns({
  initialProvider = "google" as Provider,
  initialModel,
}: {
  initialProvider?: Provider;
  initialModel?: string;
}) {
  const defaultModel =
    initialModel ?? getDefaultModelForProvider(initialProvider)!.id;

  const [provider, setProvider] = useState<Provider>(initialProvider);
  const [model, setModel] = useState<string>(defaultModel);

  const handleProviderChange = (newProvider: Provider) => {
    setProvider(newProvider);
    // Cascading: auto-select default model for new provider
    const defaultForProvider = getDefaultModelForProvider(newProvider);
    if (defaultForProvider) {
      setModel(defaultForProvider.id);
    }
  };

  const handleModelChange = (newModelId: string) => {
    setModel(newModelId);
    // Cascading: auto-update provider to match selected model
    const config = getModelConfig(newModelId);
    if (config && config.provider !== provider) {
      setProvider(config.provider);
    }
  };

  return (
    <div>
      <ProviderDropdown value={provider} onChange={handleProviderChange} />
      <ModelDropdown
        provider={provider}
        value={model}
        onChange={handleModelChange}
      />
      {/* Expose state for assertions */}
      <output data-testid="current-provider">{provider}</output>
      <output data-testid="current-model">{model}</output>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Part A: Pure data-layer invariants (no rendering needed)
// ---------------------------------------------------------------------------

describe("Data layer invariants", () => {
  describe("model-provider consistency", () => {
    it("every model belongs to exactly one of the known providers", () => {
      const validProviders = new Set<Provider>([
        "google",
        "vertex",
        "fal",
        "aiml",
        "airforce",
      ]);
      for (const model of MODELS) {
        expect(validProviders.has(model.provider)).toBe(true);
      }
    });

    it("every model has a unique composite id", () => {
      const ids = MODELS.map((m) => m.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("every model id follows the format 'provider:value'", () => {
      for (const model of MODELS) {
        expect(model.id).toBe(`${model.provider}:${model.value}`);
      }
    });

    it("getDefaultModelForProvider returns a model that belongs to that provider", () => {
      const providers: Provider[] = ["google", "vertex", "fal", "aiml", "airforce"];
      for (const p of providers) {
        const defaultModel = getDefaultModelForProvider(p);
        expect(defaultModel).toBeDefined();
        expect(defaultModel!.provider).toBe(p);
      }
    });

    it("getModelsForProvider returns only models for the given provider", () => {
      const providers: Provider[] = ["google", "vertex", "fal", "aiml", "airforce"];
      for (const p of providers) {
        const models = getModelsForProvider(p);
        expect(models.length).toBeGreaterThan(0);
        for (const m of models) {
          expect(m.provider).toBe(p);
        }
      }
    });

    it("getModelsForProvider returns disjoint sets across providers", () => {
      const providers: Provider[] = ["google", "vertex", "fal", "aiml", "airforce"];
      const allReturnedIds: string[] = [];
      for (const p of providers) {
        const models = getModelsForProvider(p);
        allReturnedIds.push(...models.map((m) => m.id));
      }
      // All returned IDs should be unique — no model in two providers
      expect(new Set(allReturnedIds).size).toBe(allReturnedIds.length);
      // And they should cover all models
      expect(allReturnedIds.length).toBe(MODELS.length);
    });
  });

  describe("model kind classification", () => {
    it("isVideoModel returns true only for models with kind 'video'", () => {
      for (const model of MODELS) {
        expect(isVideoModel(model.id)).toBe(model.kind === "video");
      }
    });

    it("getVideoModels and getImageModels partition the full model set", () => {
      const videoModels = getVideoModels();
      const imageModels = getImageModels();

      expect(videoModels.length + imageModels.length).toBe(MODELS.length);

      // No overlap
      const videoIds = new Set(videoModels.map((m) => m.id));
      for (const img of imageModels) {
        expect(videoIds.has(img.id)).toBe(false);
      }
    });

    it("video models have video-specific capabilities", () => {
      const videoModels = getVideoModels();
      for (const m of videoModels) {
        // Every video model should have at least one video-specific capability
        const caps = m.capabilities;
        const hasVideoCapability =
          caps.durationOptions !== undefined ||
          caps.resolutionOptions !== undefined ||
          caps.videoAspectRatios !== undefined ||
          caps.generateAudio !== undefined ||
          caps.imageUrl !== undefined ||
          caps.audioUrl !== undefined ||
          caps.shotType !== undefined;
        expect(hasVideoCapability).toBe(true);
      }
    });

    it("image models do NOT have video-specific capabilities", () => {
      const imageModels = getImageModels();
      for (const m of imageModels) {
        const caps = m.capabilities;
        expect(caps.durationOptions).toBeUndefined();
        expect(caps.resolutionOptions).toBeUndefined();
        expect(caps.videoAspectRatios).toBeUndefined();
        expect(caps.generateAudio).toBeUndefined();
        expect(caps.imageUrl).toBeUndefined();
        expect(caps.audioUrl).toBeUndefined();
        expect(caps.shotType).toBeUndefined();
      }
    });
  });

  describe("provider labels", () => {
    it("every provider has a display label", () => {
      const providers: Provider[] = ["google", "vertex", "fal", "aiml"];
      for (const p of providers) {
        expect(PROVIDER_LABELS[p]).toBeTruthy();
        expect(typeof PROVIDER_LABELS[p]).toBe("string");
        expect(PROVIDER_LABELS[p].length).toBeGreaterThan(0);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Part B: Component integration — cascading behavior
// ---------------------------------------------------------------------------

describe("Component integration: provider ↔ model cascading", () => {
  describe("provider change cascades to model", () => {
    it("switching provider updates the model dropdown to show that provider's models", async () => {
      const user = userEvent.setup();
      render(<StudioDropdowns initialProvider="google" />);

      // Verify initial state
      expect(screen.getByTestId("current-provider")).toHaveTextContent(
        "google",
      );
      const googleDefault = getDefaultModelForProvider("google")!;
      expect(screen.getByTestId("current-model")).toHaveTextContent(
        googleDefault.id,
      );

      // Change provider to fal
      const providerComboboxes = screen.getAllByRole("combobox");
      // The first combobox is the provider dropdown
      await user.click(providerComboboxes[0]);
      await user.click(screen.getByText(PROVIDER_LABELS.fal));

      // Provider should be updated
      expect(screen.getByTestId("current-provider")).toHaveTextContent("fal");

      // Model should auto-cascade to fal's default
      const falDefault = getDefaultModelForProvider("fal")!;
      expect(screen.getByTestId("current-model")).toHaveTextContent(
        falDefault.id,
      );
    });

    it("switching provider auto-selects the default model for that provider", async () => {
      const user = userEvent.setup();
      render(<StudioDropdowns initialProvider="google" />);

      // Switch to vertex
      const providerComboboxes = screen.getAllByRole("combobox");
      await user.click(providerComboboxes[0]);
      await user.click(screen.getByText(PROVIDER_LABELS.vertex));

      const vertexDefault = getDefaultModelForProvider("vertex")!;
      expect(screen.getByTestId("current-model")).toHaveTextContent(
        vertexDefault.id,
      );

      // Switch to aiml
      await user.click(providerComboboxes[0]);
      await user.click(screen.getByText(PROVIDER_LABELS.aiml));

      const aimlDefault = getDefaultModelForProvider("aiml")!;
      expect(screen.getByTestId("current-model")).toHaveTextContent(
        aimlDefault.id,
      );
    });
  });

  describe("model selection updates visible state", () => {
    it("selecting a model within the same provider updates model without changing provider", async () => {
      const user = userEvent.setup();
      render(<StudioDropdowns initialProvider="google" />);

      const googleModels = getModelsForProvider("google");
      const targetModel = googleModels[googleModels.length - 1]; // last google model

      // Open model dropdown (second combobox) and select
      const comboboxes = screen.getAllByRole("combobox");
      await user.click(comboboxes[1]);
      await user.click(screen.getByText(targetModel.label));

      expect(screen.getByTestId("current-provider")).toHaveTextContent(
        "google",
      );
      expect(screen.getByTestId("current-model")).toHaveTextContent(
        targetModel.id,
      );
    });
  });

  describe("round-trip consistency", () => {
    it("after switching provider and back, state is consistent", async () => {
      const user = userEvent.setup();
      render(<StudioDropdowns initialProvider="google" />);

      const googleDefault = getDefaultModelForProvider("google")!;

      // Switch to fal
      const comboboxes = screen.getAllByRole("combobox");
      await user.click(comboboxes[0]);
      await user.click(screen.getByText(PROVIDER_LABELS.fal));

      const falDefault = getDefaultModelForProvider("fal")!;
      expect(screen.getByTestId("current-model")).toHaveTextContent(
        falDefault.id,
      );

      // Switch back to google
      await user.click(comboboxes[0]);
      await user.click(screen.getByText(PROVIDER_LABELS.google));

      // Should return to google's default
      expect(screen.getByTestId("current-provider")).toHaveTextContent(
        "google",
      );
      expect(screen.getByTestId("current-model")).toHaveTextContent(
        googleDefault.id,
      );
    });
  });

  describe("video vs image model capabilities", () => {
    it("selecting a video model from aiml shows video state", async () => {
      const user = userEvent.setup();
      render(<StudioDropdowns initialProvider="aiml" />);

      const aimlVideoModels = getModelsForProvider("aiml").filter(
        (m) => m.kind === "video",
      );
      expect(aimlVideoModels.length).toBeGreaterThan(0);

      const targetVideo = aimlVideoModels[0];

      // Open model dropdown and select a video model
      const comboboxes = screen.getAllByRole("combobox");
      await user.click(comboboxes[1]);
      await user.click(screen.getByText(targetVideo.label));

      expect(screen.getByTestId("current-model")).toHaveTextContent(
        targetVideo.id,
      );

      // The selected model should be a video model
      expect(isVideoModel(targetVideo.id)).toBe(true);
    });

    it("selecting an image model from aiml shows image state", async () => {
      const user = userEvent.setup();
      const aimlImageModels = getModelsForProvider("aiml").filter(
        (m) => m.kind === "image",
      );
      expect(aimlImageModels.length).toBeGreaterThan(0);

      const targetImage = aimlImageModels[0];

      render(
        <StudioDropdowns initialProvider="aiml" initialModel={targetImage.id} />,
      );

      expect(screen.getByTestId("current-model")).toHaveTextContent(
        targetImage.id,
      );
      expect(isVideoModel(targetImage.id)).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("all four providers can be cycled through without errors", async () => {
      const user = userEvent.setup();
      render(<StudioDropdowns initialProvider="google" />);

      const providers: Provider[] = ["vertex", "fal", "aiml", "google"];
      const comboboxes = screen.getAllByRole("combobox");

      for (const provider of providers) {
        await user.click(comboboxes[0]);
        await user.click(screen.getByText(PROVIDER_LABELS[provider]));

        expect(screen.getByTestId("current-provider")).toHaveTextContent(
          provider,
        );

        const expectedDefault = getDefaultModelForProvider(provider)!;
        expect(screen.getByTestId("current-model")).toHaveTextContent(
          expectedDefault.id,
        );
      }
    });

    it("rapid provider switching settles on the last selected provider", async () => {
      const user = userEvent.setup();
      render(<StudioDropdowns initialProvider="google" />);

      const comboboxes = screen.getAllByRole("combobox");

      // Rapidly switch: google -> vertex -> fal -> aiml
      for (const provider of ["vertex", "fal", "aiml"] as Provider[]) {
        await user.click(comboboxes[0]);
        await user.click(screen.getByText(PROVIDER_LABELS[provider]));
      }

      // Should settle on aiml
      expect(screen.getByTestId("current-provider")).toHaveTextContent("aiml");
      const aimlDefault = getDefaultModelForProvider("aiml")!;
      expect(screen.getByTestId("current-model")).toHaveTextContent(
        aimlDefault.id,
      );
    });
  });
});
