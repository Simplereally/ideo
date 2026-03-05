/**
 * ApiKeyDialog — Executable Specification (BYOK)
 *
 * CONTRACT:
 *   The dialog renders editable inputs for each provider's BYOK fields.
 *   Values are persisted into `useSettingsStore` on every keystroke (autosave).
 *   Secret fields are masked by default with a reveal toggle.
 *   Provider status badges reflect both local keys and server-side config.
 *   Clear buttons remove stored keys per-provider.
 *
 * TEST STRATEGY:
 *   - Mock `useProviderStatus` for server-side connection status.
 *   - Mock `useStudio` to open the dialog (isApiKeyDialogOpen: true).
 *   - Use a real (in-memory) `useSettingsStore` -- reset between tests.
 *   - Assert BYOK input, persist, masked display, reveal, clear, reopen flows.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks -- vi.hoisted runs BEFORE vi.mock factory evaluation, so every
// value referenced inside a vi.mock factory must originate from here.
// ---------------------------------------------------------------------------

const {
  closeFnRef,
  mockStatus,
  mockLoadingRef,
  useSettingsStore,
} = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const zustand = require("zustand");

  const defaults = {
    googleApiKey: "",
    falApiKey: "",
    aimlApiKey: "",
    vertexProjectId: "",
    vertexLocation: "us-central1",
    vertexAccessToken: "",
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const store = zustand.create((set: any) => ({
    ...defaults,
    setGoogleApiKey: (key: string) => set({ googleApiKey: key }),
    setFalApiKey: (key: string) => set({ falApiKey: key }),
    setAimlApiKey: (key: string) => set({ aimlApiKey: key }),
    setVertexProjectId: (id: string) => set({ vertexProjectId: id }),
    setVertexLocation: (location: string) => set({ vertexLocation: location }),
    setVertexAccessToken: (token: string) => set({ vertexAccessToken: token }),
    clearKeys: () => set(defaults),
  }));

  // Mutable ref — vi.fn isn't available inside vi.hoisted, so we use a
  // container that module-scope code fills before any test runs.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const closeFnRef: { current: any } = { current: (..._args: unknown[]) => {} };

  return {
    closeFnRef,
    mockStatus: { google: false, vertex: false, fal: false, aiml: false },
    mockLoadingRef: { current: false },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useSettingsStore: store as any,
  };
});

// Now that module scope is executing, wire up the real vi.fn.
const closeApiKeyDialogFn = vi.fn();
closeFnRef.current = closeApiKeyDialogFn;

vi.mock("@/lib/store", () => ({
  useStudio: () => ({
    state: { isApiKeyDialogOpen: true },
    // Delegate to the ref so the mock factory captures the container, not null.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    closeApiKeyDialog: (...args: any[]) => closeFnRef.current(...args),
  }),
}));

vi.mock("@/hooks/use-provider-status", () => ({
  useProviderStatus: () => ({
    status: { ...mockStatus },
    loading: mockLoadingRef.current,
  }),
}));

// Separator: purely decorative
vi.mock("@/components/ui/separator", () => ({
  Separator: ({ className }: { className?: string }) => (
    <hr className={className} />
  ),
}));

vi.mock("@/store/settings", () => ({
  useSettingsStore,
  PERSIST_NAME: "ideo-api-keys",
}));

// ---------------------------------------------------------------------------
// Component under test
// ---------------------------------------------------------------------------

import { ApiKeyDialog, PROVIDER_FIELDS } from "../api-key-dialog";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderDialog() {
  return render(<ApiKeyDialog />);
}

function setProviderStatus(overrides: Partial<typeof mockStatus>) {
  Object.assign(mockStatus, overrides);
}

function resetProviderStatus() {
  mockStatus.google = false;
  mockStatus.vertex = false;
  mockStatus.fal = false;
  mockStatus.aiml = false;
  mockLoadingRef.current = false;
}

function resetSettingsStore() {
  useSettingsStore.setState({
    googleApiKey: "",
    falApiKey: "",
    aimlApiKey: "",
    vertexProjectId: "",
    vertexLocation: "us-central1",
    vertexAccessToken: "",
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ApiKeyDialog", () => {
  beforeEach(() => {
    resetProviderStatus();
    resetSettingsStore();
    closeApiKeyDialogFn.mockClear();
  });

  // -------------------------------------------------------------------------
  // 1) Header & BYOK guidance
  // -------------------------------------------------------------------------

  describe("header and guidance", () => {
    it("renders the dialog title", () => {
      renderDialog();
      expect(screen.getByText("API Integrations")).toBeInTheDocument();
    });

    it("explains that keys are stored locally", () => {
      renderDialog();
      expect(
        screen.getByText(/keys are stored locally/i),
      ).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 2) Provider list renders all providers
  // -------------------------------------------------------------------------

  describe("provider list", () => {
    it("renders all four provider names", () => {
      renderDialog();
      expect(screen.getByText("Google AI")).toBeInTheDocument();
      expect(screen.getByText("Vertex AI")).toBeInTheDocument();
      expect(screen.getByText("Fal AI")).toBeInTheDocument();
      expect(screen.getByText("AI/ML")).toBeInTheDocument();
    });

    it("renders docs links for each provider", () => {
      renderDialog();
      const docsLinks = screen.getAllByText("Docs");
      expect(docsLinks).toHaveLength(4);
      for (const link of docsLinks) {
        const anchor = link.closest("a");
        expect(anchor).toHaveAttribute("target", "_blank");
        expect(anchor).toHaveAttribute("rel", "noopener noreferrer");
      }
    });
  });

  // -------------------------------------------------------------------------
  // 3) BYOK input fields exist
  // -------------------------------------------------------------------------

  describe("BYOK input fields", () => {
    it("renders input fields for simple providers (google, fal, aiml)", () => {
      renderDialog();
      // Each of these has a single "API Key" field
      expect(
        screen.getByPlaceholderText("AIza\u2026"),
      ).toBeInTheDocument(); // google
      expect(
        screen.getByPlaceholderText("fal_\u2026"),
      ).toBeInTheDocument(); // fal
      expect(
        screen.getByPlaceholderText("sk-\u2026"),
      ).toBeInTheDocument(); // aiml
    });

    it("renders 3 fields for Vertex (project id, location, access token)", () => {
      renderDialog();
      expect(
        screen.getByPlaceholderText("my-gcp-project"),
      ).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("us-central1"),
      ).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("ya29.\u2026"),
      ).toBeInTheDocument();
    });

    it("Vertex location defaults to us-central1", () => {
      renderDialog();
      const locationInput = screen.getByPlaceholderText(
        "us-central1",
      ) as HTMLInputElement;
      expect(locationInput.value).toBe("us-central1");
    });
  });

  // -------------------------------------------------------------------------
  // 4) Typing keys persists into store (autosave)
  // -------------------------------------------------------------------------

  describe("typing keys persists into store", () => {
    it("typing a Google API key updates the store", async () => {
      const user = userEvent.setup();
      renderDialog();

      const input = screen.getByPlaceholderText("AIza\u2026");
      await user.click(input);
      await user.type(input, "AIzaTestKey123");

      expect(useSettingsStore.getState().googleApiKey).toBe("AIzaTestKey123");
    });

    it("typing a Fal API key updates the store", async () => {
      const user = userEvent.setup();
      renderDialog();

      const input = screen.getByPlaceholderText("fal_\u2026");
      await user.click(input);
      await user.type(input, "fal_test_key");

      expect(useSettingsStore.getState().falApiKey).toBe("fal_test_key");
    });

    it("typing an AI/ML API key updates the store", async () => {
      const user = userEvent.setup();
      renderDialog();

      const input = screen.getByPlaceholderText("sk-\u2026");
      await user.click(input);
      await user.type(input, "sk-aiml-key");

      expect(useSettingsStore.getState().aimlApiKey).toBe("sk-aiml-key");
    });

    it("typing Vertex fields updates the store", async () => {
      const user = userEvent.setup();
      renderDialog();

      const projectInput = screen.getByPlaceholderText("my-gcp-project");
      await user.click(projectInput);
      await user.type(projectInput, "my-proj");

      const locationInput = screen.getByPlaceholderText("us-central1");
      await user.clear(locationInput);
      await user.type(locationInput, "europe-west1");

      const tokenInput = screen.getByPlaceholderText("ya29.\u2026");
      await user.click(tokenInput);
      await user.type(tokenInput, "ya29.token");

      const state = useSettingsStore.getState();
      expect(state.vertexProjectId).toBe("my-proj");
      expect(state.vertexLocation).toBe("europe-west1");
      expect(state.vertexAccessToken).toBe("ya29.token");
    });
  });

  // -------------------------------------------------------------------------
  // 5) Reopening shows stored values
  // -------------------------------------------------------------------------

  describe("reopening shows stored values", () => {
    it("re-render shows previously stored key", async () => {
      // Pre-populate the store
      useSettingsStore.setState({ googleApiKey: "AIzaPersisted" });

      renderDialog();

      const input = screen.getByPlaceholderText("AIza\u2026") as HTMLInputElement;
      // The value should be present (masked or not, the input value is set)
      expect(input.value).toBe("AIzaPersisted");
    });

    it("Vertex fields show stored values on reopen", () => {
      useSettingsStore.setState({
        vertexProjectId: "stored-proj",
        vertexLocation: "asia-east1",
        vertexAccessToken: "ya29.stored",
      });

      renderDialog();

      expect(
        (screen.getByPlaceholderText("my-gcp-project") as HTMLInputElement)
          .value,
      ).toBe("stored-proj");
      expect(
        (screen.getByPlaceholderText("us-central1") as HTMLInputElement).value,
      ).toBe("asia-east1");
      expect(
        (screen.getByPlaceholderText("ya29.\u2026") as HTMLInputElement).value,
      ).toBe("ya29.stored");
    });
  });

  // -------------------------------------------------------------------------
  // 6) Secret input masking & reveal toggle
  // -------------------------------------------------------------------------

  describe("secret masking and reveal", () => {
    it("secret fields render as password type by default", () => {
      renderDialog();
      const googleInput = screen.getByPlaceholderText(
        "AIza\u2026",
      ) as HTMLInputElement;
      expect(googleInput.type).toBe("password");
    });

    it("clicking reveal toggle changes type to text", async () => {
      const user = userEvent.setup();
      renderDialog();

      // Find the reveal button nearest to the google input
      const revealButtons = screen.getAllByLabelText("Reveal value");
      expect(revealButtons.length).toBeGreaterThan(0);

      await user.click(revealButtons[0]);

      // Now the google input should be text type
      const googleInput = screen.getByPlaceholderText(
        "AIza\u2026",
      ) as HTMLInputElement;
      expect(googleInput.type).toBe("text");
    });

    it("clicking hide button toggles back to password", async () => {
      const user = userEvent.setup();
      renderDialog();

      // Reveal
      const revealButton = screen.getAllByLabelText("Reveal value")[0];
      await user.click(revealButton);

      // Hide
      const hideButton = screen.getByLabelText("Hide value");
      await user.click(hideButton);

      const googleInput = screen.getByPlaceholderText(
        "AIza\u2026",
      ) as HTMLInputElement;
      expect(googleInput.type).toBe("password");
    });

    it("non-secret fields (Vertex project id, location) render as text type", () => {
      renderDialog();
      const projectInput = screen.getByPlaceholderText(
        "my-gcp-project",
      ) as HTMLInputElement;
      expect(projectInput.type).toBe("text");

      const locationInput = screen.getByPlaceholderText(
        "us-central1",
      ) as HTMLInputElement;
      expect(locationInput.type).toBe("text");
    });
  });

  // -------------------------------------------------------------------------
  // 7) Clear / remove keys
  // -------------------------------------------------------------------------

  describe("clear keys", () => {
    it("clear button appears when a key is set", async () => {
      useSettingsStore.setState({ googleApiKey: "some-key" });
      renderDialog();

      expect(
        screen.getByLabelText("Clear Google AI keys"),
      ).toBeInTheDocument();
    });

    it("clear button does NOT appear when no key is set", () => {
      renderDialog();
      expect(
        screen.queryByLabelText("Clear Google AI keys"),
      ).not.toBeInTheDocument();
    });

    it("clicking clear removes the key from the store", async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ googleApiKey: "to-be-cleared" });
      renderDialog();

      const clearBtn = screen.getByLabelText("Clear Google AI keys");
      await user.click(clearBtn);

      expect(useSettingsStore.getState().googleApiKey).toBe("");
    });

    it("clicking clear on Vertex resets all 3 fields (location to default)", async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({
        vertexProjectId: "proj",
        vertexLocation: "europe-west1",
        vertexAccessToken: "token",
      });
      renderDialog();

      const clearBtn = screen.getByLabelText("Clear Vertex AI keys");
      await user.click(clearBtn);

      const state = useSettingsStore.getState();
      expect(state.vertexProjectId).toBe("");
      expect(state.vertexLocation).toBe("us-central1");
      expect(state.vertexAccessToken).toBe("");
    });
  });

  // -------------------------------------------------------------------------
  // 8) Status badges
  // -------------------------------------------------------------------------

  describe("status badges", () => {
    it("shows 'Not configured' when no keys are set and server is disconnected", () => {
      renderDialog();
      const badges = screen.getAllByText("Not configured");
      expect(badges).toHaveLength(4);
    });

    it("shows 'Key set' when user has entered a key", () => {
      useSettingsStore.setState({ googleApiKey: "user-key" });
      renderDialog();
      expect(screen.getByText("Key set")).toBeInTheDocument();
    });

    it("shows 'Server key' when server is connected but no local key", () => {
      setProviderStatus({ fal: true });
      renderDialog();
      expect(screen.getByText("Server key")).toBeInTheDocument();
    });

    it("shows correct connected count in header", () => {
      useSettingsStore.setState({ googleApiKey: "k" });
      setProviderStatus({ fal: true });
      renderDialog();
      // Badge renders count and "/4 connected" as separate text nodes
      const badge = screen.getByText((_content, el) =>
        el?.tagName === "SPAN" &&
        el?.getAttribute("data-slot") === "badge" &&
        el?.textContent === "2/4 connected",
      );
      expect(badge).toBeInTheDocument();
    });

    it("shows 0/4 when nothing is configured", () => {
      renderDialog();
      const badge = screen.getByText((_content, el) =>
        el?.tagName === "SPAN" &&
        el?.getAttribute("data-slot") === "badge" &&
        el?.textContent === "0/4 connected",
      );
      expect(badge).toBeInTheDocument();
    });

    it("shows 4/4 when all configured", () => {
      useSettingsStore.setState({
        googleApiKey: "g",
        falApiKey: "f",
        aimlApiKey: "a",
        vertexAccessToken: "v",
      });
      renderDialog();
      const badge = screen.getByText((_content, el) =>
        el?.tagName === "SPAN" &&
        el?.getAttribute("data-slot") === "badge" &&
        el?.textContent === "4/4 connected",
      );
      expect(badge).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 9) Close behavior
  // -------------------------------------------------------------------------

  describe("close behavior", () => {
    it("calls closeApiKeyDialog when the Close button is clicked", async () => {
      const user = userEvent.setup();
      renderDialog();

      await user.click(screen.getByRole("button", { name: /close/i }));
      expect(closeApiKeyDialogFn).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // 10) PROVIDER_FIELDS export structure
  // -------------------------------------------------------------------------

  describe("PROVIDER_FIELDS structure", () => {
    it("google has 1 field", () => {
      expect(PROVIDER_FIELDS.google).toHaveLength(1);
    });

    it("fal has 1 field", () => {
      expect(PROVIDER_FIELDS.fal).toHaveLength(1);
    });

    it("aiml has 1 field", () => {
      expect(PROVIDER_FIELDS.aiml).toHaveLength(1);
    });

    it("vertex has 3 fields", () => {
      expect(PROVIDER_FIELDS.vertex).toHaveLength(3);
    });

    it("vertex fields include project id, location, and access token", () => {
      const keys = PROVIDER_FIELDS.vertex.map((f) => f.key);
      expect(keys).toContain("vertexProjectId");
      expect(keys).toContain("vertexLocation");
      expect(keys).toContain("vertexAccessToken");
    });
  });
});
