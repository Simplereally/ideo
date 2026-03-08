"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface SettingsState {
  // Google (Gemini / Vertex via Google AI SDK)
  googleApiKey: string;

  // fal.ai
  falApiKey: string;

  // AI/ML API
  aimlApiKey: string;

  // Airforce API
  airforceApiKey: string;

  // Vertex AI (service-account flow)
  vertexProjectId: string;
  vertexLocation: string;
  vertexAccessToken: string;
}

interface SettingsActions {
  setGoogleApiKey: (key: string) => void;
  setFalApiKey: (key: string) => void;
  setAimlApiKey: (key: string) => void;
  setAirforceApiKey: (key: string) => void;
  setVertexProjectId: (id: string) => void;
  setVertexLocation: (location: string) => void;
  setVertexAccessToken: (token: string) => void;
  clearKeys: () => void;
}

export type SettingsStore = SettingsState & SettingsActions;

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

// Persisted defaults – everything that is safe to write to localStorage.
const DEFAULT_PERSISTED_STATE: Omit<SettingsState, "vertexAccessToken"> = {
  googleApiKey: "",
  falApiKey: "",
  aimlApiKey: "",
  airforceApiKey: "",
  vertexProjectId: "",
  vertexLocation: "us-central1",
};

// Full defaults (includes in-memory-only fields).
const DEFAULT_STATE: SettingsState = {
  ...DEFAULT_PERSISTED_STATE,
  vertexAccessToken: "",
};

// ---------------------------------------------------------------------------
// Persist config name.
//
// NOTE: We intentionally use "ideo-api-keys" rather than "ideo-settings"
// because src/lib/store.tsx performs a one-time localStorage.removeItem
// on "ideo-settings" (legacy cleanup). Using a distinct key avoids that
// conflict without requiring changes to the studio store.
// ---------------------------------------------------------------------------

export const PERSIST_NAME = "ideo-api-keys";

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_STATE,

      setGoogleApiKey: (key) => set({ googleApiKey: key }),
      setFalApiKey: (key) => set({ falApiKey: key }),
      setAimlApiKey: (key) => set({ aimlApiKey: key }),
      setAirforceApiKey: (key) => set({ airforceApiKey: key }),
      setVertexProjectId: (id) => set({ vertexProjectId: id }),
      setVertexLocation: (location) => set({ vertexLocation: location }),
      setVertexAccessToken: (token) => set({ vertexAccessToken: token }),
      clearKeys: () => set(DEFAULT_STATE),
    }),
    {
      name: PERSIST_NAME,
      storage: createJSONStorage(() => localStorage),

      // Exclude vertexAccessToken from localStorage – it stays in-memory only.
      partialize: ({ vertexAccessToken: _, ...persisted }) => persisted,

      // Preserve the current in-memory token when rehydrating persisted keys.
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<SettingsStore>),
      }),
    },
  ),
);
