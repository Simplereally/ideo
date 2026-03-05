/**
 * video-polling + BYOK integration test
 *
 * Verifies that the fetcher closure pattern (as used in prompt-composer.tsx)
 * correctly reads the BYOK API key from the settings store at each invocation
 * and forwards it to `getVideoGeneration`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getVideoGeneration } from "./aiml-video";
import { buildProviderCredentials } from "./provider-credentials";
import type { SettingsState } from "@/store/settings";

// ---------------------------------------------------------------------------
// Shared mutable state that simulates the settings store.
// ---------------------------------------------------------------------------

const mockStoreState: Pick<
  SettingsState,
  "googleApiKey" | "falApiKey" | "aimlApiKey" | "vertexAccessToken" | "vertexProjectId" | "vertexLocation"
> = {
  googleApiKey: "",
  falApiKey: "",
  aimlApiKey: "",
  vertexAccessToken: "",
  vertexProjectId: "",
  vertexLocation: "us-central1",
};

// Mock the settings store module — the import in the test resolves to this.
vi.mock("@/store/settings", () => ({
  useSettingsStore: {
    getState: () => mockStoreState,
  },
}));

// Import the mocked store so the fetcher closure can reference it.
import { useSettingsStore } from "@/store/settings";

// ---------------------------------------------------------------------------
// Mock global fetch
// ---------------------------------------------------------------------------

const fetchSpy = vi.fn<typeof globalThis.fetch>();

beforeEach(() => {
  fetchSpy.mockReset();
  vi.stubGlobal("fetch", fetchSpy);
  mockStoreState.aimlApiKey = "";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the exact fetcher closure that prompt-composer.tsx uses inside
 * `startPollingJob`. This mirrors the real code:
 *
 * ```ts
 * const creds = buildProviderCredentials("aiml", useSettingsStore.getState());
 * const apiKey = creds && "apiKey" in creds ? creds.apiKey : undefined;
 * return getVideoGeneration(jobId, apiKey);
 * ```
 */
function makeFetcher(jobId: string) {
  return () => {
    const creds = buildProviderCredentials("aiml", useSettingsStore.getState());
    const apiKey = creds && "apiKey" in creds ? creds.apiKey : undefined;
    return getVideoGeneration(jobId, apiKey);
  };
}

function respondWith(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("polling fetcher forwards BYOK apiKey from settings store", () => {
  it("includes apiKey in fetch URL when store has a key", async () => {
    mockStoreState.aimlApiKey = "sk-byok-test";
    fetchSpy.mockResolvedValueOnce(
      respondWith({ id: "job-1", status: "generating" }),
    );

    const fetcher = makeFetcher("job-1");
    await fetcher();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url] = fetchSpy.mock.calls[0];
    const parsed = new URL(url as string, "http://localhost");
    expect(parsed.searchParams.get("apiKey")).toBe("sk-byok-test");
    expect(parsed.searchParams.get("generation_id")).toBe("job-1");
  });

  it("omits apiKey when store has no key configured", async () => {
    mockStoreState.aimlApiKey = "";
    fetchSpy.mockResolvedValueOnce(
      respondWith({ id: "job-2", status: "completed", video_url: "https://x.com/v.mp4" }),
    );

    const fetcher = makeFetcher("job-2");
    await fetcher();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url] = fetchSpy.mock.calls[0];
    const parsed = new URL(url as string, "http://localhost");
    expect(parsed.searchParams.has("apiKey")).toBe(false);
  });

  it("omits apiKey when store key is whitespace-only", async () => {
    mockStoreState.aimlApiKey = "   ";
    fetchSpy.mockResolvedValueOnce(
      respondWith({ id: "job-3", status: "generating" }),
    );

    const fetcher = makeFetcher("job-3");
    await fetcher();

    const [url] = fetchSpy.mock.calls[0];
    const parsed = new URL(url as string, "http://localhost");
    expect(parsed.searchParams.has("apiKey")).toBe(false);
  });

  it("reads key fresh on every call (picks up changes between ticks)", async () => {
    const fetcher = makeFetcher("job-4");

    // First call: no key
    mockStoreState.aimlApiKey = "";
    fetchSpy.mockResolvedValueOnce(
      respondWith({ id: "job-4", status: "generating" }),
    );
    await fetcher();

    const firstUrl = new URL(fetchSpy.mock.calls[0][0] as string, "http://localhost");
    expect(firstUrl.searchParams.has("apiKey")).toBe(false);

    // Simulate user entering a key between polls
    mockStoreState.aimlApiKey = "sk-new-key";
    fetchSpy.mockResolvedValueOnce(
      respondWith({ id: "job-4", status: "completed", video_url: "https://x.com/final.mp4" }),
    );
    await fetcher();

    const secondUrl = new URL(fetchSpy.mock.calls[1][0] as string, "http://localhost");
    expect(secondUrl.searchParams.get("apiKey")).toBe("sk-new-key");
  });

  it("handles key rotation (key changes between consecutive calls)", async () => {
    const fetcher = makeFetcher("job-5");

    // First call: key A
    mockStoreState.aimlApiKey = "key-A";
    fetchSpy.mockResolvedValueOnce(
      respondWith({ id: "job-5", status: "generating" }),
    );
    await fetcher();

    // Second call: key B
    mockStoreState.aimlApiKey = "key-B";
    fetchSpy.mockResolvedValueOnce(
      respondWith({ id: "job-5", status: "generating" }),
    );
    await fetcher();

    const urlA = new URL(fetchSpy.mock.calls[0][0] as string, "http://localhost");
    const urlB = new URL(fetchSpy.mock.calls[1][0] as string, "http://localhost");
    expect(urlA.searchParams.get("apiKey")).toBe("key-A");
    expect(urlB.searchParams.get("apiKey")).toBe("key-B");
  });
});
