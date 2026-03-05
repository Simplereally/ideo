/**
 * useSettingsStore -- BYOK key storage unit tests
 *
 * Validates:
 *  1. Default values match spec
 *  2. Individual setters update the correct field
 *  3. clearKeys resets all fields to defaults
 *  4. Persist config name is stable
 *
 * These tests exercise the store in isolation (pure behavior, no DOM).
 * We reset the store between tests to guarantee isolation.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useSettingsStore, PERSIST_NAME } from "@/store/settings";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reset store to defaults before each test. */
beforeEach(() => {
  useSettingsStore.getState().clearKeys();
});

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

describe("default values", () => {
  it("has empty string defaults for all API keys", () => {
    const s = useSettingsStore.getState();
    expect(s.googleApiKey).toBe("");
    expect(s.falApiKey).toBe("");
    expect(s.aimlApiKey).toBe("");
    expect(s.vertexProjectId).toBe("");
    expect(s.vertexAccessToken).toBe("");
  });

  it("defaults vertexLocation to us-central1", () => {
    expect(useSettingsStore.getState().vertexLocation).toBe("us-central1");
  });
});

// ---------------------------------------------------------------------------
// Setters
// ---------------------------------------------------------------------------

describe("setters", () => {
  it("setGoogleApiKey updates googleApiKey", () => {
    useSettingsStore.getState().setGoogleApiKey("gk-123");
    expect(useSettingsStore.getState().googleApiKey).toBe("gk-123");
  });

  it("setFalApiKey updates falApiKey", () => {
    useSettingsStore.getState().setFalApiKey("fal-abc");
    expect(useSettingsStore.getState().falApiKey).toBe("fal-abc");
  });

  it("setAimlApiKey updates aimlApiKey", () => {
    useSettingsStore.getState().setAimlApiKey("aiml-xyz");
    expect(useSettingsStore.getState().aimlApiKey).toBe("aiml-xyz");
  });

  it("setVertexProjectId updates vertexProjectId", () => {
    useSettingsStore.getState().setVertexProjectId("my-project");
    expect(useSettingsStore.getState().vertexProjectId).toBe("my-project");
  });

  it("setVertexLocation updates vertexLocation", () => {
    useSettingsStore.getState().setVertexLocation("europe-west4");
    expect(useSettingsStore.getState().vertexLocation).toBe("europe-west4");
  });

  it("setVertexAccessToken updates vertexAccessToken", () => {
    useSettingsStore.getState().setVertexAccessToken("ya29.token");
    expect(useSettingsStore.getState().vertexAccessToken).toBe("ya29.token");
  });

  it("setting one key does not affect others", () => {
    useSettingsStore.getState().setGoogleApiKey("gk-only");
    const s = useSettingsStore.getState();
    expect(s.googleApiKey).toBe("gk-only");
    expect(s.falApiKey).toBe("");
    expect(s.aimlApiKey).toBe("");
    expect(s.vertexProjectId).toBe("");
    expect(s.vertexLocation).toBe("us-central1");
    expect(s.vertexAccessToken).toBe("");
  });
});

// ---------------------------------------------------------------------------
// clearKeys
// ---------------------------------------------------------------------------

describe("clearKeys", () => {
  it("resets all fields to defaults", () => {
    const { setGoogleApiKey, setFalApiKey, setAimlApiKey, setVertexProjectId, setVertexLocation, setVertexAccessToken } =
      useSettingsStore.getState();

    // Dirty every field
    setGoogleApiKey("gk-dirty");
    setFalApiKey("fal-dirty");
    setAimlApiKey("aiml-dirty");
    setVertexProjectId("proj-dirty");
    setVertexLocation("asia-east1");
    setVertexAccessToken("ya29.dirty");

    // Verify dirty
    expect(useSettingsStore.getState().googleApiKey).toBe("gk-dirty");

    // Clear
    useSettingsStore.getState().clearKeys();

    const s = useSettingsStore.getState();
    expect(s.googleApiKey).toBe("");
    expect(s.falApiKey).toBe("");
    expect(s.aimlApiKey).toBe("");
    expect(s.vertexProjectId).toBe("");
    expect(s.vertexLocation).toBe("us-central1");
    expect(s.vertexAccessToken).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Persist config
// ---------------------------------------------------------------------------

describe("persist config", () => {
  it("uses a stable persist name", () => {
    expect(PERSIST_NAME).toBe("ideo-api-keys");
  });

  it("the store's persist name matches the exported constant", () => {
    // Zustand persist exposes the name via the persist API
    const persistOptions = (useSettingsStore as unknown as { persist: { getOptions: () => { name: string } } }).persist.getOptions();
    expect(persistOptions.name).toBe(PERSIST_NAME);
  });
});
