/**
 * Provider Credentials — BYOK wiring tests
 *
 * Tests the pure functions that build and inject provider credentials
 * into generation request payloads, plus integration tests that verify
 * fetch request bodies include the correct credential shapes when
 * keys are set in the settings store.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildProviderCredentials,
  injectCredentials,
  type SimpleKeyCredentials,
  type VertexCredentials,
} from "./provider-credentials";
import type { SettingsState } from "@/store/settings";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPTY_SETTINGS: Pick<
  SettingsState,
  | "googleApiKey"
  | "falApiKey"
  | "aimlApiKey"
  | "airforceApiKey"
  | "vertexAccessToken"
  | "vertexProjectId"
  | "vertexLocation"
> = {
  googleApiKey: "",
  falApiKey: "",
  aimlApiKey: "",
  airforceApiKey: "",
  vertexAccessToken: "",
  vertexProjectId: "",
  vertexLocation: "us-central1",
};

// ---------------------------------------------------------------------------
// buildProviderCredentials
// ---------------------------------------------------------------------------

describe("buildProviderCredentials", () => {
  describe("returns undefined when keys are empty", () => {
    it("google — empty key", () => {
      expect(buildProviderCredentials("google", EMPTY_SETTINGS)).toBeUndefined();
    });
    it("fal — empty key", () => {
      expect(buildProviderCredentials("fal", EMPTY_SETTINGS)).toBeUndefined();
    });
    it("aiml — empty key", () => {
      expect(buildProviderCredentials("aiml", EMPTY_SETTINGS)).toBeUndefined();
    });
    it("vertex — empty token and project", () => {
      expect(buildProviderCredentials("vertex", EMPTY_SETTINGS)).toBeUndefined();
    });
    it("vertex — token set but no project", () => {
      expect(
        buildProviderCredentials("vertex", {
          ...EMPTY_SETTINGS,
          vertexAccessToken: "tok",
          vertexProjectId: "",
        }),
      ).toBeUndefined();
    });
    it("vertex — project set but no token", () => {
      expect(
        buildProviderCredentials("vertex", {
          ...EMPTY_SETTINGS,
          vertexProjectId: "proj-1",
          vertexAccessToken: "",
        }),
      ).toBeUndefined();
    });
    it("whitespace-only key treated as empty", () => {
      expect(
        buildProviderCredentials("google", {
          ...EMPTY_SETTINGS,
          googleApiKey: "   ",
        }),
      ).toBeUndefined();
    });
  });

  describe("returns SimpleKeyCredentials for google/fal/aiml", () => {
    it("google", () => {
      const result = buildProviderCredentials("google", {
        ...EMPTY_SETTINGS,
        googleApiKey: "goog-key-123",
      }) as SimpleKeyCredentials;
      expect(result).toEqual({ apiKey: "goog-key-123" });
    });
    it("fal", () => {
      const result = buildProviderCredentials("fal", {
        ...EMPTY_SETTINGS,
        falApiKey: "fal-key-456",
      }) as SimpleKeyCredentials;
      expect(result).toEqual({ apiKey: "fal-key-456" });
    });
    it("aiml", () => {
      const result = buildProviderCredentials("aiml", {
        ...EMPTY_SETTINGS,
        aimlApiKey: "aiml-key-789",
      }) as SimpleKeyCredentials;
      expect(result).toEqual({ apiKey: "aiml-key-789" });
    });
    it("trims whitespace", () => {
      const result = buildProviderCredentials("google", {
        ...EMPTY_SETTINGS,
        googleApiKey: "  trimmed  ",
      }) as SimpleKeyCredentials;
      expect(result).toEqual({ apiKey: "trimmed" });
    });
  });

  describe("returns VertexCredentials for vertex", () => {
    it("includes accessToken, projectId, and location", () => {
      const result = buildProviderCredentials("vertex", {
        ...EMPTY_SETTINGS,
        vertexAccessToken: "ya29.xxx",
        vertexProjectId: "my-project",
        vertexLocation: "europe-west1",
      }) as VertexCredentials;
      expect(result).toEqual({
        accessToken: "ya29.xxx",
        projectId: "my-project",
        location: "europe-west1",
      });
    });
    it("defaults location to us-central1 when empty", () => {
      const result = buildProviderCredentials("vertex", {
        ...EMPTY_SETTINGS,
        vertexAccessToken: "tok",
        vertexProjectId: "proj",
        vertexLocation: "",
      }) as VertexCredentials;
      expect(result.location).toBe("us-central1");
    });
    it("trims all fields", () => {
      const result = buildProviderCredentials("vertex", {
        ...EMPTY_SETTINGS,
        vertexAccessToken: " tok ",
        vertexProjectId: " proj ",
        vertexLocation: " loc ",
      }) as VertexCredentials;
      expect(result).toEqual({
        accessToken: "tok",
        projectId: "proj",
        location: "loc",
      });
    });
  });
});

// ---------------------------------------------------------------------------
// injectCredentials
// ---------------------------------------------------------------------------

describe("injectCredentials", () => {
  it("returns payload unchanged when credentials are undefined", () => {
    const payload = { prompt: "hello", model: "m" };
    const result = injectCredentials(payload, undefined);
    expect(result).toEqual(payload);
    expect(result).not.toHaveProperty("credentials");
  });

  it("adds credentials key when credentials are present", () => {
    const payload = { prompt: "hello", model: "m" };
    const creds: SimpleKeyCredentials = { apiKey: "k" };
    const result = injectCredentials(payload, creds);
    expect(result).toEqual({
      prompt: "hello",
      model: "m",
      credentials: { apiKey: "k" },
    });
  });

  it("adds vertex credentials with full shape", () => {
    const payload = { prompt: "hello" };
    const creds: VertexCredentials = {
      accessToken: "tok",
      projectId: "proj",
      location: "us",
    };
    const result = injectCredentials(payload, creds);
    expect(result.credentials).toEqual(creds);
  });

  it("does not mutate the original payload", () => {
    const payload = { prompt: "hello" };
    const creds: SimpleKeyCredentials = { apiKey: "k" };
    const result = injectCredentials(payload, creds);
    expect(payload).not.toHaveProperty("credentials");
    expect(result).not.toBe(payload);
  });
});

// ---------------------------------------------------------------------------
// Integration: fetch body assertions
// ---------------------------------------------------------------------------

describe("BYOK credentials in fetch requests", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ imageUrl: "https://example.com/img.png" }),
    });
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * Simulate what the prompt-composer does: build payload, inject credentials,
   * and pass to fetch. This is a pure functional test — no React rendering.
   */
  async function simulateImageGeneration(
    provider: "google" | "fal" | "aiml" | "vertex",
    settings: typeof EMPTY_SETTINGS,
  ) {
    const credentials = buildProviderCredentials(provider, settings);
    const payload = { prompt: "test", model: "test-model", provider };
    const body = credentials
      ? injectCredentials(payload, credentials)
      : payload;

    await fetch(`/api/generate/${provider}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return JSON.parse(fetchSpy.mock.calls[0][1].body as string);
  }

  it("includes google apiKey in body when set", async () => {
    const body = await simulateImageGeneration("google", {
      ...EMPTY_SETTINGS,
      googleApiKey: "gk-123",
    });
    expect(body.credentials).toEqual({ apiKey: "gk-123" });
  });

  it("includes fal apiKey in body when set", async () => {
    const body = await simulateImageGeneration("fal", {
      ...EMPTY_SETTINGS,
      falApiKey: "fk-456",
    });
    expect(body.credentials).toEqual({ apiKey: "fk-456" });
  });

  it("includes aiml apiKey in body when set", async () => {
    const body = await simulateImageGeneration("aiml", {
      ...EMPTY_SETTINGS,
      aimlApiKey: "ak-789",
    });
    expect(body.credentials).toEqual({ apiKey: "ak-789" });
  });

  it("includes vertex credentials object in body when set", async () => {
    const body = await simulateImageGeneration("vertex", {
      ...EMPTY_SETTINGS,
      vertexAccessToken: "ya29.tok",
      vertexProjectId: "my-proj",
      vertexLocation: "eu-west1",
    });
    expect(body.credentials).toEqual({
      accessToken: "ya29.tok",
      projectId: "my-proj",
      location: "eu-west1",
    });
  });

  it("omits credentials key when no keys are set", async () => {
    const body = await simulateImageGeneration("google", EMPTY_SETTINGS);
    expect(body).not.toHaveProperty("credentials");
  });

  it("omits credentials key for aiml when key is empty", async () => {
    const body = await simulateImageGeneration("aiml", EMPTY_SETTINGS);
    expect(body).not.toHaveProperty("credentials");
  });
});

// ---------------------------------------------------------------------------
// Video generation integration
// ---------------------------------------------------------------------------

describe("BYOK credentials in video generation", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ id: "vid-1", status: "queued" }),
    });
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("includes aiml credentials in video creation request when set", async () => {
    // Dynamic import to pick up the mocked fetch
    const { createVideoGeneration } = await import("./video-generation");

    const credentials = buildProviderCredentials("aiml", {
      ...EMPTY_SETTINGS,
      aimlApiKey: "vid-key",
    });

    await createVideoGeneration({
      provider: "aiml",
      model: "test-video-model",
      params: { prompt: "a dancing cat" },
      credentials,
    });

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(body.credentials).toEqual({ apiKey: "vid-key" });
  });

  it("omits credentials from video request when key is empty", async () => {
    const { createVideoGeneration } = await import("./video-generation");

    const credentials = buildProviderCredentials("aiml", EMPTY_SETTINGS);

    await createVideoGeneration({
      provider: "aiml",
      model: "test-video-model",
      params: { prompt: "a dancing cat" },
      credentials,
    });

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(body).not.toHaveProperty("credentials");
  });
});
