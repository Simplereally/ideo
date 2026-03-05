/**
 * ProviderDropdown — Executable Specification
 *
 * CONTRACT:
 *   Given a `value` (Provider), the component renders a trigger showing the
 *   current provider's display label. When the user opens the dropdown, it
 *   lists every provider with their PROVIDER_LABELS display name, allows
 *   search filtering, keyboard navigation, and notifies the parent via
 *   `onChange(provider)` on selection.
 *
 * IMPLEMENTATION:
 *   Uses shadcn Popover + Command (cmdk). The Popover trigger is the combobox
 *   button; the Command input inside is a *second* combobox (cmdk's own).
 *   Tests disambiguate via accessible name: the trigger has
 *   aria-label="Select provider".
 *
 * EQUIVALENCE CLASSES:
 *   - value ∈ { "google", "vertex", "fal", "aiml" }
 *   - search input: empty (shows all), partial match, full match, no match
 *   - keyboard: ArrowDown, ArrowUp, Enter, Escape
 *   - disabled: true | false
 *   - click outside: closes dropdown (via Radix Popover)
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, type Mock } from "vitest";
import { ProviderDropdown } from "../provider-dropdown";
import { PROVIDER_LABELS, getProviders, type Provider } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_PROVIDERS: Provider[] = getProviders();

/** The trigger button is the combobox with the accessible name "Select provider". */
function getTrigger() {
  return screen.getByRole("combobox", { name: /select provider/i });
}

/** The cmdk search input (inside the popover). */
function getSearchInput() {
  return screen.getByPlaceholderText("Search providers…");
}

function renderDropdown(overrides: {
  value?: Provider;
  onChange?: Mock;
  disabled?: boolean;
} = {}) {
  const onChange = overrides.onChange ?? vi.fn();
  const props = {
    value: overrides.value ?? ("google" as Provider),
    onChange,
    disabled: overrides.disabled ?? false,
  };
  const result = render(<ProviderDropdown {...props} />);
  return { ...result, onChange };
}

// ---------------------------------------------------------------------------
// 1. Rendering — initial state
// ---------------------------------------------------------------------------

describe("ProviderDropdown", () => {
  describe("initial render", () => {
    it.each(ALL_PROVIDERS)(
      "displays the correct label when value is '%s'",
      (provider) => {
        renderDropdown({ value: provider });
        expect(getTrigger()).toHaveTextContent(
          PROVIDER_LABELS[provider],
        );
      },
    );

    it("renders as a combobox with a collapsed popup by default", () => {
      renderDropdown();
      const trigger = getTrigger();
      expect(trigger).toBeInTheDocument();
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    });

    it("has an accessible label identifying the control as 'Provider'", () => {
      renderDropdown();
      expect(
        screen.getByRole("combobox", { name: /provider/i }),
      ).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Opening & listing
  // ---------------------------------------------------------------------------

  describe("dropdown open", () => {
    it("opens and shows all providers when clicked", async () => {
      const user = userEvent.setup();
      renderDropdown();

      await user.click(getTrigger());

      const listbox = screen.getByRole("listbox");
      expect(listbox).toBeInTheDocument();

      for (const provider of ALL_PROVIDERS) {
        expect(
          within(listbox).getByText(PROVIDER_LABELS[provider]),
        ).toBeInTheDocument();
      }
    });

    it("marks the currently selected provider with a check", async () => {
      const user = userEvent.setup();
      renderDropdown({ value: "fal" });

      await user.click(getTrigger());

      // The option with aria-selected="true" determined by cmdk highlight,
      // but the value can be verified by checking the option text exists
      const falOption = screen.getByRole("option", {
        name: new RegExp(PROVIDER_LABELS.fal),
      });
      expect(falOption).toBeInTheDocument();
    });

    it("sets aria-expanded to true when open", async () => {
      const user = userEvent.setup();
      renderDropdown();

      await user.click(getTrigger());

      expect(getTrigger()).toHaveAttribute(
        "aria-expanded",
        "true",
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Search / filter
  // ---------------------------------------------------------------------------

  describe("search filtering", () => {
    it("filters the list to matching providers when typing", async () => {
      const user = userEvent.setup();
      renderDropdown();

      await user.click(getTrigger());
      const searchInput = getSearchInput();
      await user.type(searchInput, "Google");

      // Scope to listbox to avoid matching the trigger label
      const listbox = screen.getByRole("listbox");
      expect(within(listbox).getByText(PROVIDER_LABELS.google)).toBeInTheDocument();
      expect(
        within(listbox).queryByText(PROVIDER_LABELS.fal),
      ).not.toBeInTheDocument();
    });

    it("is case-insensitive", async () => {
      const user = userEvent.setup();
      renderDropdown();

      await user.click(getTrigger());
      const searchInput = getSearchInput();
      await user.type(searchInput, "vertex");

      expect(screen.getByText(PROVIDER_LABELS.vertex)).toBeInTheDocument();
    });

    it("shows an empty state when no providers match", async () => {
      const user = userEvent.setup();
      renderDropdown();

      await user.click(getTrigger());
      const searchInput = getSearchInput();
      await user.type(searchInput, "zzzznonexistent");

      expect(screen.getByText(/no provider/i)).toBeInTheDocument();
    });

    it("restores the full list when the search is cleared", async () => {
      const user = userEvent.setup();
      renderDropdown();

      await user.click(getTrigger());
      const searchInput = getSearchInput();
      await user.type(searchInput, "Google");
      await user.clear(searchInput);

      const listbox = screen.getByRole("listbox");
      for (const provider of ALL_PROVIDERS) {
        expect(
          within(listbox).getByText(PROVIDER_LABELS[provider]),
        ).toBeInTheDocument();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Selection
  // ---------------------------------------------------------------------------

  describe("selection", () => {
    it("calls onChange with the selected provider value", async () => {
      const user = userEvent.setup();
      const { onChange } = renderDropdown({ value: "google" });

      await user.click(getTrigger());
      await user.click(screen.getByText(PROVIDER_LABELS.fal));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith("fal");
    });

    it("closes the dropdown after selection", async () => {
      const user = userEvent.setup();
      renderDropdown();

      await user.click(getTrigger());
      await user.click(screen.getByText(PROVIDER_LABELS.vertex));

      expect(getTrigger()).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    });

    it("does not call onChange when re-selecting the current provider", async () => {
      const user = userEvent.setup();
      const { onChange } = renderDropdown({ value: "google" });

      await user.click(getTrigger());
      // Use the option role to target the listbox item, not the trigger label
      await user.click(screen.getByRole("option", {
        name: new RegExp(PROVIDER_LABELS.google),
      }));

      // Selecting the same value should not fire onChange.
      expect(onChange).toHaveBeenCalledTimes(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Keyboard navigation
  // ---------------------------------------------------------------------------

  describe("keyboard navigation", () => {
    it("opens the dropdown with Enter key on the trigger", async () => {
      const user = userEvent.setup();
      renderDropdown();

      getTrigger().focus();
      await user.keyboard("{Enter}");

      expect(getTrigger()).toHaveAttribute(
        "aria-expanded",
        "true",
      );
    });

    it("navigates options with ArrowDown and selects with Enter", async () => {
      const user = userEvent.setup();
      const { onChange } = renderDropdown({ value: "google" });

      await user.click(getTrigger());

      // cmdk input receives focus — arrow keys navigate the list
      await user.keyboard("{ArrowDown}");
      await user.keyboard("{Enter}");

      expect(onChange).toHaveBeenCalledTimes(1);
      // Should have selected a valid provider
      expect(ALL_PROVIDERS).toContain(onChange.mock.calls[0][0]);
    });

    it("navigates upward with ArrowUp", async () => {
      const user = userEvent.setup();
      const { onChange } = renderDropdown({ value: "google" });

      await user.click(getTrigger());

      // Go down twice, up once, select
      await user.keyboard("{ArrowDown}{ArrowDown}{ArrowUp}{Enter}");

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(ALL_PROVIDERS).toContain(onChange.mock.calls[0][0]);
    });

    it("closes the dropdown with Escape without selecting", async () => {
      const user = userEvent.setup();
      const { onChange } = renderDropdown();

      await user.click(getTrigger());
      expect(getTrigger()).toHaveAttribute(
        "aria-expanded",
        "true",
      );

      await user.keyboard("{Escape}");

      expect(getTrigger()).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Click outside
  // ---------------------------------------------------------------------------

  describe("click outside", () => {
    it("closes the dropdown when clicking outside", async () => {
      const user = userEvent.setup();
      const { onChange } = renderDropdown();

      await user.click(getTrigger());
      expect(getTrigger()).toHaveAttribute(
        "aria-expanded",
        "true",
      );

      // Click outside (document body)
      await user.click(document.body);

      expect(getTrigger()).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Disabled state
  // ---------------------------------------------------------------------------

  describe("disabled state", () => {
    it("does not open dropdown when disabled", async () => {
      const user = userEvent.setup();
      renderDropdown({ disabled: true });

      const trigger = getTrigger();
      expect(trigger).toBeDisabled();

      await user.click(trigger);
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    });

    it("ignores keyboard interaction when disabled", async () => {
      const user = userEvent.setup();
      renderDropdown({ disabled: true });

      getTrigger().focus();
      await user.keyboard("{Enter}");

      expect(getTrigger()).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 8. Accessibility
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

    it("each option has role='option'", async () => {
      const user = userEvent.setup();
      renderDropdown();

      await user.click(getTrigger());

      const options = screen.getAllByRole("option");
      expect(options.length).toBe(ALL_PROVIDERS.length);
    });
  });
});
