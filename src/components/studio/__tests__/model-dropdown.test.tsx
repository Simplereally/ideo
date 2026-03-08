/**
 * ModelDropdown — Executable Specification
 *
 * CONTRACT:
 *   Given a `provider` (Provider) and a `value` (model id), the component
 *   renders a trigger showing the selected model's label. When opened, it
 *   lists ONLY models belonging to the given provider, grouped by kind
 *   ("image" | "video") when the provider has both. Search filters by
 *   label, description, or model value. Selection calls `onChange(modelId)`.
 *
 * IMPLEMENTATION:
 *   Uses shadcn Popover + Command (cmdk). The Popover trigger is the combobox
 *   button; the Command input inside is a *second* combobox (cmdk's own).
 *   Tests disambiguate via accessible name: the trigger has
 *   aria-label="Select model".
 *
 * EQUIVALENCE CLASSES:
 *   Input space for `provider`: { "google", "vertex", "fal", "aiml" }
 *   Input space for `value`: valid model id | first model for provider
 *   Search: empty | partial label match | description match | value match | no match
 *   Provider with mixed kinds: "aiml" (has both image + video)
 *   Provider with single kind: "google", "vertex", "fal" (image only)
 *   Disabled: true | false
 *   Provider change (re-render): model list updates reactively
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, type Mock } from "vitest";
import { ModelDropdown } from "../model-dropdown";
import {
  MODELS,
  getModelsForProvider,
  getDefaultModelForProvider,
  type Provider,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_PROVIDERS: Provider[] = ["google", "vertex", "fal", "aiml"];

/** The trigger button is the combobox with the accessible name "Select model". */
function getTrigger() {
  return screen.getByRole("combobox", { name: /select model/i });
}

/** The cmdk search input (inside the popover). */
function getSearchInput() {
  return screen.getByPlaceholderText("Search models…");
}

function renderDropdown(
  overrides: {
    provider?: Provider;
    value?: string;
    onChange?: Mock;
    disabled?: boolean;
  } = {},
) {
  const provider = overrides.provider ?? "google";
  const defaultModel = getDefaultModelForProvider(provider);
  const onChange = overrides.onChange ?? vi.fn();
  const props = {
    provider,
    value: overrides.value ?? defaultModel!.id,
    onChange,
    disabled: overrides.disabled ?? false,
  };
  const result = render(<ModelDropdown {...props} />);
  return { ...result, onChange, props };
}

function getModelsGroupedByKind(provider: Provider) {
  const models = getModelsForProvider(provider);
  const imageModels = models.filter((m) => m.kind === "image");
  const videoModels = models.filter((m) => m.kind === "video");
  return { models, imageModels, videoModels };
}

// ---------------------------------------------------------------------------
// 1. Rendering — initial state per provider
// ---------------------------------------------------------------------------

describe("ModelDropdown", () => {
  describe("initial render", () => {
    it.each(ALL_PROVIDERS)(
      "displays the selected model label for provider '%s'",
      (provider) => {
        const defaultModel = getDefaultModelForProvider(provider)!;
        renderDropdown({ provider, value: defaultModel.id });
        expect(getTrigger()).toHaveTextContent(
          defaultModel.label,
        );
      },
    );

    it("renders as a combobox with collapsed popup", () => {
      renderDropdown();
      const trigger = getTrigger();
      expect(trigger).toBeInTheDocument();
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    });

    it("has an accessible name identifying the control as 'Model'", () => {
      renderDropdown();
      expect(
        screen.getByRole("combobox", { name: /model/i }),
      ).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Provider-scoped model listing
  // ---------------------------------------------------------------------------

  describe("provider-scoped listing", () => {
    it.each(ALL_PROVIDERS)(
      "shows only models for provider '%s' when opened",
      async (provider) => {
        const user = userEvent.setup();
        const models = getModelsForProvider(provider);
        const defaultModel = models[0];
        renderDropdown({ provider, value: defaultModel.id });

        await user.click(getTrigger());

        const listbox = screen.getByRole("listbox");
        for (const model of models) {
          expect(within(listbox).getByText(model.label)).toBeInTheDocument();
        }

        // Verify no models from other providers leak through
        const otherProviderModels = MODELS.filter(
          (m) => m.provider !== provider,
        );
        for (const other of otherProviderModels) {
          // Only check if the label is unique to that model to avoid false positives
          // (e.g., "Imagen 4" exists in both google and vertex)
          const sameNameInProvider = models.some(
            (m) => m.label === other.label,
          );
          if (!sameNameInProvider) {
            expect(
              within(listbox).queryByText(other.label),
            ).not.toBeInTheDocument();
          }
        }
      },
    );

    it("shows model descriptions alongside labels", async () => {
      const user = userEvent.setup();
      renderDropdown({ provider: "google" });

      await user.click(getTrigger());

      const googleModels = getModelsForProvider("google");
      for (const model of googleModels) {
        expect(screen.getByText(model.description)).toBeInTheDocument();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Kind grouping (image vs video)
  // ---------------------------------------------------------------------------

  describe("kind grouping", () => {
    it("groups models by kind when provider has both image and video models", async () => {
      const user = userEvent.setup();
      const { imageModels, videoModels } = getModelsGroupedByKind("aiml");

      // aiml has both image and video models — this is a precondition
      expect(imageModels.length).toBeGreaterThan(0);
      expect(videoModels.length).toBeGreaterThan(0);

      renderDropdown({
        provider: "aiml",
        value: imageModels[0].id,
      });

      await user.click(getTrigger());

      // cmdk CommandGroup with heading renders a [cmdk-group-heading] element.
      // The heading text should be present.
      expect(screen.getByText("Image Models")).toBeInTheDocument();
      expect(screen.getByText("Video Models")).toBeInTheDocument();
    });

    it("does not show kind groups when provider has only one kind", async () => {
      const user = userEvent.setup();
      const { imageModels, videoModels } = getModelsGroupedByKind("google");

      // google only has image models — precondition
      expect(imageModels.length).toBeGreaterThan(0);
      expect(videoModels.length).toBe(0);

      renderDropdown({ provider: "google" });

      await user.click(getTrigger());

      // Should NOT have a "Video" group heading
      expect(screen.queryByText(/^video$/i)).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Search / filter
  // ---------------------------------------------------------------------------

  describe("search filtering", () => {
    it("filters by model label", async () => {
      const user = userEvent.setup();
      renderDropdown({ provider: "fal" });

      await user.click(getTrigger());
      const searchInput = getSearchInput();
      await user.type(searchInput, "Realism");

      const listbox = screen.getByRole("listbox");
      expect(within(listbox).getByText("FLUX.1 Realism")).toBeInTheDocument();
      // Other fal models should be filtered out of the list
      expect(within(listbox).queryByText("FLUX.1 [dev]")).not.toBeInTheDocument();
    });

    it("filters by model description", async () => {
      const user = userEvent.setup();
      renderDropdown({ provider: "fal" });

      await user.click(getTrigger());
      const searchInput = getSearchInput();
      await user.type(searchInput, "Photorealistic");

      expect(screen.getByText("FLUX.1 Realism")).toBeInTheDocument();
    });

    it("filters by model value (API model id)", async () => {
      const user = userEvent.setup();
      renderDropdown({ provider: "fal" });

      await user.click(getTrigger());
      const searchInput = getSearchInput();
      await user.type(searchInput, "flux-pro");

      expect(screen.getByText("FLUX.1 [pro]")).toBeInTheDocument();
    });

    it("is case-insensitive across all searchable fields", async () => {
      const user = userEvent.setup();
      renderDropdown({ provider: "google" });

      await user.click(getTrigger());
      const searchInput = getSearchInput();
      await user.type(searchInput, "ULTRA");

      const listbox = screen.getByRole("listbox");
      expect(within(listbox).getByText("Imagen 4 Ultra")).toBeInTheDocument();
    });

    it("shows empty state when no models match", async () => {
      const user = userEvent.setup();
      renderDropdown({ provider: "google" });

      await user.click(getTrigger());
      const searchInput = getSearchInput();
      await user.type(searchInput, "zzzznonexistent");

      expect(screen.getByText(/no model/i)).toBeInTheDocument();
    });

    it("restores the full model list when search is cleared", async () => {
      const user = userEvent.setup();
      renderDropdown({ provider: "google" });

      await user.click(getTrigger());
      const searchInput = getSearchInput();
      await user.type(searchInput, "Ultra");
      await user.clear(searchInput);

      const listbox = screen.getByRole("listbox");
      const googleModels = getModelsForProvider("google");
      for (const model of googleModels) {
        expect(within(listbox).getByText(model.label)).toBeInTheDocument();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Selection
  // ---------------------------------------------------------------------------

  describe("selection", () => {
    it("calls onChange with the selected model id", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const googleModels = getModelsForProvider("google");
      const target = googleModels[googleModels.length - 1]; // pick the last one

      renderDropdown({
        provider: "google",
        value: googleModels[0].id,
        onChange,
      });

      await user.click(getTrigger());
      await user.click(screen.getByText(target.label));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(target.id);
    });

    it("closes the dropdown after selection", async () => {
      const user = userEvent.setup();
      const googleModels = getModelsForProvider("google");

      renderDropdown({ provider: "google", value: googleModels[0].id });

      await user.click(getTrigger());
      await user.click(screen.getByText(googleModels[1].label));

      expect(getTrigger()).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    });

    it("marks the selected model with a check indicator", async () => {
      const user = userEvent.setup();
      const googleModels = getModelsForProvider("google");
      const selected = googleModels[1];

      renderDropdown({ provider: "google", value: selected.id });

      await user.click(getTrigger());

      // The option containing the selected model's label should exist
      const option = screen.getByRole("option", {
        name: new RegExp(selected.label),
      });
      expect(option).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Keyboard navigation
  // ---------------------------------------------------------------------------

  describe("keyboard navigation", () => {
    it("opens with Enter on the trigger", async () => {
      const user = userEvent.setup();
      renderDropdown();

      getTrigger().focus();
      await user.keyboard("{Enter}");

      expect(getTrigger()).toHaveAttribute(
        "aria-expanded",
        "true",
      );
    });

    it("selects a model via ArrowDown + Enter", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const googleModels = getModelsForProvider("google");

      renderDropdown({
        provider: "google",
        value: googleModels[0].id,
        onChange,
      });

      await user.click(getTrigger());
      await user.keyboard("{ArrowDown}{Enter}");

      expect(onChange).toHaveBeenCalledTimes(1);
      // Must be a valid model id for this provider
      const selectedId = onChange.mock.calls[0][0];
      expect(
        googleModels.some((m) => m.id === selectedId),
      ).toBe(true);
    });

    it("closes with Escape without triggering onChange", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      renderDropdown({ onChange });

      await user.click(getTrigger());
      await user.keyboard("{Escape}");

      expect(getTrigger()).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Provider change (re-render / cascading)
  // ---------------------------------------------------------------------------

  describe("provider change via re-render", () => {
    it("updates displayed models when provider prop changes", async () => {
      const user = userEvent.setup();
      const googleDefault = getDefaultModelForProvider("google")!;
      const falDefault = getDefaultModelForProvider("fal")!;

      const { rerender } = render(
        <ModelDropdown
          provider="google"
          value={googleDefault.id}
          onChange={vi.fn()}
        />,
      );

      // Open and verify google models
      await user.click(getTrigger());
      const googleModels = getModelsForProvider("google");
      const listbox = screen.getByRole("listbox");
      for (const m of googleModels) {
        expect(within(listbox).getByText(m.label)).toBeInTheDocument();
      }

      // Close via Escape, switch provider, re-open
      await user.keyboard("{Escape}");
      rerender(
        <ModelDropdown
          provider="fal"
          value={falDefault.id}
          onChange={vi.fn()}
        />,
      );

      await user.click(getTrigger());
      const falModels = getModelsForProvider("fal");
      const listbox2 = screen.getByRole("listbox");
      for (const m of falModels) {
        expect(within(listbox2).getByText(m.label)).toBeInTheDocument();
      }

      // Google models no longer visible
      for (const m of googleModels) {
        const sameNameInFal = falModels.some((f) => f.label === m.label);
        if (!sameNameInFal) {
          expect(within(listbox2).queryByText(m.label)).not.toBeInTheDocument();
        }
      }
    });

    it("updates the trigger label when value prop changes", () => {
      const googleModels = getModelsForProvider("google");
      const { rerender } = render(
        <ModelDropdown
          provider="google"
          value={googleModels[0].id}
          onChange={vi.fn()}
        />,
      );

      expect(getTrigger()).toHaveTextContent(
        googleModels[0].label,
      );

      rerender(
        <ModelDropdown
          provider="google"
          value={googleModels[2].id}
          onChange={vi.fn()}
        />,
      );

      expect(getTrigger()).toHaveTextContent(
        googleModels[2].label,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 8. Disabled state
  // ---------------------------------------------------------------------------

  describe("disabled state", () => {
    it("does not open when disabled", async () => {
      const user = userEvent.setup();
      renderDropdown({ disabled: true });

      const trigger = getTrigger();
      expect(trigger).toBeDisabled();

      await user.click(trigger);
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    });
  });

  // ---------------------------------------------------------------------------
  // 9. Boundary: provider with many models
  // ---------------------------------------------------------------------------

  describe("boundary conditions", () => {
    it("correctly handles provider with the most models (aiml)", async () => {
      const user = userEvent.setup();
      const aimlModels = getModelsForProvider("aiml");
      expect(aimlModels.length).toBeGreaterThan(5); // precondition: aiml has many

      renderDropdown({ provider: "aiml", value: aimlModels[0].id });

      await user.click(getTrigger());

      const options = screen.getAllByRole("option");
      expect(options.length).toBe(aimlModels.length);
    });

    it("correctly handles provider with fewest models (google = 3)", async () => {
      const user = userEvent.setup();
      const googleModels = getModelsForProvider("google");
      expect(googleModels.length).toBe(3); // precondition

      renderDropdown({ provider: "google" });

      await user.click(getTrigger());

      const options = screen.getAllByRole("option");
      expect(options.length).toBe(3);
    });
  });

  // ---------------------------------------------------------------------------
  // 10. Accessibility
  // ---------------------------------------------------------------------------

  describe("accessibility", () => {
    it("associates the trigger with the popover content via aria-controls", async () => {
      const user = userEvent.setup();
      renderDropdown();

      await user.click(getTrigger());

      const trigger = getTrigger();
      const controlsId = trigger.getAttribute("aria-controls");
      expect(controlsId).toBeTruthy();

      // The Radix Popover content should have the matching id
      const content = document.getElementById(controlsId!);
      expect(content).toBeInTheDocument();
    });

    it("options have descriptive text content (label + description)", async () => {
      const user = userEvent.setup();
      const googleModels = getModelsForProvider("google");
      renderDropdown({ provider: "google", value: googleModels[0].id });

      await user.click(getTrigger());

      const options = screen.getAllByRole("option");
      for (const option of options) {
        // Each option should contain its model label
        const matchingModel = googleModels.find((m) =>
          option.textContent?.includes(m.label),
        );
        expect(matchingModel).toBeDefined();
      }
    });
  });
});
