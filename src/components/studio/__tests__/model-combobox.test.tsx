import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderStatus } from "@/app/api/providers/status/route";
import { ModelCombobox } from "../model-combobox";

const {
  loadingRef,
  statusRef,
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
  }));

  const statusRef: { current: ProviderStatus } = {
    current: { google: false, vertex: false, fal: false, aiml: false, airforce: false },
  };
  const loadingRef = { current: false };

  return {
    loadingRef,
    statusRef,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useSettingsStore: store as any,
  };
});

const setProvider = vi.fn();
const setModel = vi.fn();

vi.mock("@/hooks/use-provider-status", () => ({
  useProviderStatus: () => ({
    status: statusRef.current,
    loading: loadingRef.current,
  }),
}));

vi.mock("@/store/settings", () => ({
  useSettingsStore,
}));

vi.mock("@/lib/store", () => ({
  useStudio: () => ({
    state: {
      provider: "aiml" as const,
      model: "aiml:x-ai/grok-2-image",
    },
    setProvider,
    setModel,
  }),
}));

function resetSettingsStore() {
  useSettingsStore.setState({
    googleApiKey: "",
    falApiKey: "",
    aimlApiKey: "",
    airforceApiKey: "",
    vertexProjectId: "",
    vertexLocation: "us-central1",
    vertexAccessToken: "",
  });
}

describe("ModelCombobox", () => {
  beforeEach(() => {
    resetSettingsStore();
    loadingRef.current = false;
    statusRef.current = { google: false, vertex: false, fal: false, aiml: false, airforce: false };
    setProvider.mockClear();
    setModel.mockClear();
  });

  it("shows only configured providers and their models in the dropdown", async () => {
    const user = userEvent.setup();
    useSettingsStore.setState({ googleApiKey: "AIza-local" });
    statusRef.current = { google: false, vertex: false, fal: true, aiml: false, airforce: false };

    render(<ModelCombobox />);

    await user.click(screen.getByRole("button"));
    const listbox = screen.getByRole("listbox");

    expect(within(listbox).getByText("Google AI Studio")).toBeInTheDocument();
    expect(within(listbox).getByText("Fal AI")).toBeInTheDocument();
    expect(within(listbox).queryByText("Vertex AI")).not.toBeInTheDocument();
    expect(within(listbox).queryByText("AI/ML API")).not.toBeInTheDocument();
  });

  it("falls back to the first available configured provider when the current one is unavailable", async () => {
    useSettingsStore.setState({ googleApiKey: "AIza-local" });

    render(<ModelCombobox />);

    await waitFor(() => {
      expect(setProvider).toHaveBeenCalledWith("google");
      expect(setModel).toHaveBeenCalledWith("google:imagen-4.0-generate-001");
    });
  });

  it("does not treat partial Vertex input as configured", async () => {
    const user = userEvent.setup();
    useSettingsStore.setState({ vertexAccessToken: "ya29.partial" });

    render(<ModelCombobox />);

    await user.click(screen.getByRole("button"));
    expect(
      screen.getByText("Configure an API integration to view models"),
    ).toBeInTheDocument();
  });

  it("shows a search empty state when configured providers exist but nothing matches", async () => {
    const user = userEvent.setup();
    useSettingsStore.setState({ googleApiKey: "AIza-local" });

    render(<ModelCombobox />);

    await user.click(screen.getByRole("button"));
    await user.type(screen.getByPlaceholderText("Search models..."), "zzzz-no-match");

    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("No models found")).toBeInTheDocument();
  });

  it("includes server-configured providers in the dropdown even without local keys", async () => {
    const user = userEvent.setup();
    statusRef.current = { google: true, vertex: false, fal: false, aiml: false, airforce: false };

    render(<ModelCombobox />);

    await user.click(screen.getByRole("button"));
    const listbox = screen.getByRole("listbox");

    expect(within(listbox).getByText("Google AI Studio")).toBeInTheDocument();
    expect(within(listbox).queryByText("Fal AI")).not.toBeInTheDocument();
  });

  it("waits for provider-status loading before applying a fallback selection", async () => {
    loadingRef.current = true;
    useSettingsStore.setState({ falApiKey: "fal_local" });

    const { rerender } = render(<ModelCombobox />);

    await waitFor(() => {
      expect(setProvider).not.toHaveBeenCalled();
      expect(setModel).not.toHaveBeenCalled();
    });

    loadingRef.current = false;
    statusRef.current = { google: true, vertex: false, fal: false, aiml: false, airforce: false };
    rerender(<ModelCombobox />);

    await waitFor(() => {
      expect(setProvider).toHaveBeenCalledWith("google");
      expect(setModel).toHaveBeenCalledWith("google:imagen-4.0-generate-001");
    });
  });
});
