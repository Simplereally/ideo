/**
 * ApiKeyDialog — Executable Specification (BYOK)
 *
 * CONTRACT:
 *   The dialog opens on a provider catalog first, then drills into a
 *   provider-specific credential screen.
 *   Values persist into `useSettingsStore` on every keystroke.
 *   Secret fields are masked by default with a reveal toggle.
 *   Provider status badges reflect local completeness and server-side config.
 *   Clear actions remove stored values per-provider.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
    airforceApiKey: "",
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
    setAirforceApiKey: (key: string) => set({ airforceApiKey: key }),
    setVertexProjectId: (id: string) => set({ vertexProjectId: id }),
    setVertexLocation: (location: string) => set({ vertexLocation: location }),
    setVertexAccessToken: (token: string) => set({ vertexAccessToken: token }),
    clearKeys: () => set(defaults),
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const closeFnRef: { current: any } = { current: (..._args: unknown[]) => {} };

  return {
    closeFnRef,
    mockStatus: { google: false, vertex: false, fal: false, aiml: false, airforce: false },
    mockLoadingRef: { current: false },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useSettingsStore: store as any,
  };
});

const closeApiKeyDialogFn = vi.fn();
closeFnRef.current = closeApiKeyDialogFn;

vi.mock("@/lib/store", () => ({
  useStudio: () => ({
    state: { isApiKeyDialogOpen: true },
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

vi.mock("@/components/ui/separator", () => ({
  Separator: ({ className }: { className?: string }) => (
    <hr className={className} />
  ),
}));

vi.mock("@/store/settings", () => ({
  useSettingsStore,
  PERSIST_NAME: "ideo-api-keys",
}));

import { ApiKeyDialog, PROVIDER_FIELDS } from "../api-key-dialog";

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
  mockStatus.airforce = false;
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

async function openProvider(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole("button", { name: `Manage ${label}` }));
}

describe("ApiKeyDialog", () => {
  beforeEach(() => {
    resetProviderStatus();
    resetSettingsStore();
    closeApiKeyDialogFn.mockClear();
  });

  describe("catalog and navigation", () => {
    it("renders the dialog title and provider-first guidance", () => {
      renderDialog();
      expect(screen.getByText("API Integrations")).toBeInTheDocument();
      expect(screen.getByText(/pick a provider first/i)).toBeInTheDocument();
    });

    it("renders all five providers in the catalog", () => {
      renderDialog();
      expect(screen.getByText("Google AI")).toBeInTheDocument();
      expect(screen.getByText("Vertex AI")).toBeInTheDocument();
      expect(screen.getByText("Fal AI")).toBeInTheDocument();
      expect(screen.getByText("AI/ML")).toBeInTheDocument();
      expect(screen.getByText("Airforce API")).toBeInTheDocument();
    });

    it("renders a docs link for each provider on the catalog view", () => {
      renderDialog();
      const docsLinks = screen.getAllByText("Docs");
      expect(docsLinks).toHaveLength(4);

      for (const link of docsLinks) {
        const anchor = link.closest("a");
        expect(anchor).toHaveAttribute("target", "_blank");
        expect(anchor).toHaveAttribute("rel", "noopener noreferrer");
      }
    });

    it("does not show provider fields until a provider is selected", () => {
      renderDialog();
      expect(screen.queryByPlaceholderText("AIza…")).not.toBeInTheDocument();
      expect(
        screen.queryByPlaceholderText("my-gcp-project"),
      ).not.toBeInTheDocument();
    });

    it("opens a provider detail screen and can navigate back", async () => {
      const user = userEvent.setup();
      renderDialog();

      await openProvider(user, "Google AI");
      expect(screen.getByPlaceholderText("AIza…")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /back/i }));
      expect(screen.getByText("API Integrations")).toBeInTheDocument();
      expect(screen.queryByPlaceholderText("AIza…")).not.toBeInTheDocument();
    });
  });

  describe("provider detail fields", () => {
    it("renders simple provider fields after selecting google, fal, and aiml", async () => {
      const user = userEvent.setup();
      renderDialog();

      await openProvider(user, "Google AI");
      expect(screen.getByPlaceholderText("AIza…")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /back/i }));

      await openProvider(user, "Fal AI");
      expect(screen.getByPlaceholderText("fal_…")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /back/i }));

      await openProvider(user, "AI/ML");
      expect(screen.getByPlaceholderText("sk-…")).toBeInTheDocument();
    });

    it("renders the full Vertex field set after selecting Vertex AI", async () => {
      const user = userEvent.setup();
      renderDialog();

      await openProvider(user, "Vertex AI");
      expect(screen.getByPlaceholderText("my-gcp-project")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("us-central1")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("ya29.…")).toBeInTheDocument();
    });

    it("Vertex location defaults to us-central1", async () => {
      const user = userEvent.setup();
      renderDialog();

      await openProvider(user, "Vertex AI");
      const locationInput = screen.getByPlaceholderText(
        "us-central1",
      ) as HTMLInputElement;
      expect(locationInput.value).toBe("us-central1");
    });
  });

  describe("typing keys persists into store", () => {
    it("typing a Google API key updates the store", async () => {
      const user = userEvent.setup();
      renderDialog();

      await openProvider(user, "Google AI");
      const input = screen.getByPlaceholderText("AIza…");
      await user.type(input, "AIzaTestKey123");

      expect(useSettingsStore.getState().googleApiKey).toBe("AIzaTestKey123");
    });

    it("typing a Fal API key updates the store", async () => {
      const user = userEvent.setup();
      renderDialog();

      await openProvider(user, "Fal AI");
      const input = screen.getByPlaceholderText("fal_…");
      await user.type(input, "fal_test_key");

      expect(useSettingsStore.getState().falApiKey).toBe("fal_test_key");
    });

    it("typing an AI/ML API key updates the store", async () => {
      const user = userEvent.setup();
      renderDialog();

      await openProvider(user, "AI/ML");
      const input = screen.getByPlaceholderText("sk-…");
      await user.type(input, "sk-aiml-key");

      expect(useSettingsStore.getState().aimlApiKey).toBe("sk-aiml-key");
    });

    it("typing Vertex fields updates the store", async () => {
      const user = userEvent.setup();
      renderDialog();

      await openProvider(user, "Vertex AI");

      const projectInput = screen.getByPlaceholderText("my-gcp-project");
      await user.type(projectInput, "my-proj");

      const locationInput = screen.getByPlaceholderText("us-central1");
      await user.clear(locationInput);
      await user.type(locationInput, "europe-west1");

      const tokenInput = screen.getByPlaceholderText("ya29.…");
      await user.type(tokenInput, "ya29.token");

      const state = useSettingsStore.getState();
      expect(state.vertexProjectId).toBe("my-proj");
      expect(state.vertexLocation).toBe("europe-west1");
      expect(state.vertexAccessToken).toBe("ya29.token");
    });
  });

  describe("stored values show on reopen", () => {
    it("shows a previously stored Google key", async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ googleApiKey: "AIzaPersisted" });

      renderDialog();
      await openProvider(user, "Google AI");

      expect((screen.getByPlaceholderText("AIza…") as HTMLInputElement).value).toBe(
        "AIzaPersisted",
      );
    });

    it("shows previously stored Vertex values", async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({
        vertexProjectId: "stored-proj",
        vertexLocation: "asia-east1",
        vertexAccessToken: "ya29.stored",
      });

      renderDialog();
      await openProvider(user, "Vertex AI");

      expect(
        (screen.getByPlaceholderText("my-gcp-project") as HTMLInputElement).value,
      ).toBe("stored-proj");
      expect(
        (screen.getByPlaceholderText("us-central1") as HTMLInputElement).value,
      ).toBe("asia-east1");
      expect((screen.getByPlaceholderText("ya29.…") as HTMLInputElement).value).toBe(
        "ya29.stored",
      );
    });
  });

  describe("secret masking and reveal", () => {
    it("secret fields render as password inputs by default", async () => {
      const user = userEvent.setup();
      renderDialog();

      await openProvider(user, "Google AI");
      const googleInput = screen.getByPlaceholderText("AIza…") as HTMLInputElement;
      expect(googleInput.type).toBe("password");
    });

    it("reveal toggle switches a secret field to text", async () => {
      const user = userEvent.setup();
      renderDialog();

      await openProvider(user, "Google AI");
      await user.click(screen.getByLabelText("Reveal value"));

      const googleInput = screen.getByPlaceholderText("AIza…") as HTMLInputElement;
      expect(googleInput.type).toBe("text");
    });

    it("hide toggle switches the field back to password", async () => {
      const user = userEvent.setup();
      renderDialog();

      await openProvider(user, "Google AI");
      await user.click(screen.getByLabelText("Reveal value"));
      await user.click(screen.getByLabelText("Hide value"));

      const googleInput = screen.getByPlaceholderText("AIza…") as HTMLInputElement;
      expect(googleInput.type).toBe("password");
    });

    it("Vertex project id and location render as text inputs", async () => {
      const user = userEvent.setup();
      renderDialog();

      await openProvider(user, "Vertex AI");
      expect(
        (screen.getByPlaceholderText("my-gcp-project") as HTMLInputElement).type,
      ).toBe("text");
      expect(
        (screen.getByPlaceholderText("us-central1") as HTMLInputElement).type,
      ).toBe("text");
    });
  });

  describe("clear keys", () => {
    it("shows a clear button when local values exist", async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ googleApiKey: "some-key" });

      renderDialog();
      await openProvider(user, "Google AI");

      expect(
        screen.getByLabelText("Clear Google AI keys"),
      ).toBeInTheDocument();
    });

    it("does not show a clear button when no local values exist", async () => {
      const user = userEvent.setup();
      renderDialog();

      await openProvider(user, "Google AI");
      expect(
        screen.queryByLabelText("Clear Google AI keys"),
      ).not.toBeInTheDocument();
    });

    it("clearing Google removes the stored key", async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ googleApiKey: "to-be-cleared" });

      renderDialog();
      await openProvider(user, "Google AI");
      await user.click(screen.getByLabelText("Clear Google AI keys"));

      expect(useSettingsStore.getState().googleApiKey).toBe("");
    });

    it("clearing Vertex resets all fields and restores the default location", async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({
        vertexProjectId: "proj",
        vertexLocation: "europe-west1",
        vertexAccessToken: "token",
      });

      renderDialog();
      await openProvider(user, "Vertex AI");
      await user.click(screen.getByLabelText("Clear Vertex AI keys"));

      const state = useSettingsStore.getState();
      expect(state.vertexProjectId).toBe("");
      expect(state.vertexLocation).toBe("us-central1");
      expect(state.vertexAccessToken).toBe("");
    });
  });

  describe("status badges and counts", () => {
    it("shows not configured for all providers by default", () => {
      renderDialog();
      expect(screen.getAllByText("Not configured")).toHaveLength(5);
    });

    it("shows Key set when a provider has all required local fields", () => {
      useSettingsStore.setState({ googleApiKey: "user-key" });
      renderDialog();

      expect(screen.getByText("Key set")).toBeInTheDocument();
    });

    it("shows Incomplete when only part of a multi-field provider is filled", () => {
      useSettingsStore.setState({ vertexAccessToken: "ya29.partial" });
      renderDialog();

      expect(screen.getByText("Incomplete")).toBeInTheDocument();
    });

    it("shows Server key when only the server is configured", () => {
      setProviderStatus({ fal: true });
      renderDialog();

      expect(screen.getByText("Server key")).toBeInTheDocument();
    });

    it("counts only complete local providers or server-configured providers as connected", () => {
      useSettingsStore.setState({
        googleApiKey: "g",
        vertexProjectId: "proj",
        vertexAccessToken: "token",
      });
      setProviderStatus({ fal: true });

      renderDialog();
      expect(screen.getByText("3/5 connected")).toBeInTheDocument();
    });

    it("does not count partial Vertex input as connected", () => {
      useSettingsStore.setState({ vertexAccessToken: "token-only" });
      renderDialog();

      expect(screen.getByText("0/5 connected")).toBeInTheDocument();
    });

    it("shows 5/5 when all providers are ready", () => {
      useSettingsStore.setState({
        googleApiKey: "g",
        falApiKey: "f",
        aimlApiKey: "a",
        airforceApiKey: "af",
        vertexProjectId: "proj",
        vertexAccessToken: "token",
      });

      renderDialog();
      expect(screen.getByText("5/5 connected")).toBeInTheDocument();
    });
  });

  describe("close behavior", () => {
    it("calls closeApiKeyDialog when the Close button is clicked", async () => {
      const user = userEvent.setup();
      renderDialog();

      await user.click(screen.getByRole("button", { name: /close/i }));
      expect(closeApiKeyDialogFn).toHaveBeenCalledTimes(1);
    });
  });

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
      const keys = PROVIDER_FIELDS.vertex.map((field) => field.key);
      expect(keys).toContain("vertexProjectId");
      expect(keys).toContain("vertexLocation");
      expect(keys).toContain("vertexAccessToken");
    });
  });
});
