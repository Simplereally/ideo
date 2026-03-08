/**
 * aiml-video.ts -- getVideoGeneration BYOK header-based auth tests
 *
 * Verifies that when an apiKey is supplied, it is sent via the `x-api-key`
 * header (not as a query parameter) so the server proxy can authenticate
 * BYOK users without leaking credentials in URLs.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getVideoGeneration } from "./aiml-video";

// ---------------------------------------------------------------------------
// Mock global fetch
// ---------------------------------------------------------------------------

const fetchSpy = vi.fn<typeof globalThis.fetch>();

beforeEach(() => {
  fetchSpy.mockReset();
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Build a minimal successful poll response body. */
function okPollBody(id: string) {
  return {
    id,
    status: "generating",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getVideoGeneration", () => {
  it("does NOT include apiKey param or header when no key is provided", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(okPollBody("gen-1")), { status: 200 }),
    );

    await getVideoGeneration("gen-1");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    const parsed = new URL(url as string, "http://localhost");
    expect(parsed.searchParams.has("apiKey")).toBe(false);
    expect(parsed.searchParams.get("generation_id")).toBe("gen-1");

    // Should not have x-api-key header
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.["x-api-key"]).toBeUndefined();
  });

  it("does NOT include apiKey param or header when key is undefined", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(okPollBody("gen-2")), { status: 200 }),
    );

    await getVideoGeneration("gen-2", undefined);

    const [url, init] = fetchSpy.mock.calls[0];
    const parsed = new URL(url as string, "http://localhost");
    expect(parsed.searchParams.has("apiKey")).toBe(false);

    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.["x-api-key"]).toBeUndefined();
  });

  it("does NOT include apiKey param or header when key is empty string", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(okPollBody("gen-3")), { status: 200 }),
    );

    await getVideoGeneration("gen-3", "");

    const [url, init] = fetchSpy.mock.calls[0];
    const parsed = new URL(url as string, "http://localhost");
    expect(parsed.searchParams.has("apiKey")).toBe(false);

    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.["x-api-key"]).toBeUndefined();
  });

  it("sends apiKey via x-api-key header (not query param) when a key is provided", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(okPollBody("gen-4")), { status: 200 }),
    );

    await getVideoGeneration("gen-4", "sk-test-key-123");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    const parsed = new URL(url as string, "http://localhost");

    // API key must NOT be in URL
    expect(parsed.searchParams.has("apiKey")).toBe(false);
    expect(parsed.searchParams.get("generation_id")).toBe("gen-4");

    // API key must be in header
    const headers = init?.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("sk-test-key-123");
  });

  it("properly handles special characters in apiKey via header", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(okPollBody("gen-5")), { status: 200 }),
    );

    const weirdKey = "key+with spaces&special=chars";
    await getVideoGeneration("gen-5", weirdKey);

    const [, init] = fetchSpy.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe(weirdKey);
  });

  it("normalizes the response into AimlVideoResult", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "gen-6",
          status: "completed",
          video_url: "https://cdn.example.com/video.mp4",
        }),
        { status: 200 },
      ),
    );

    const result = await getVideoGeneration("gen-6", "my-key");

    expect(result).toEqual({
      id: "gen-6",
      status: "completed",
      videoUrl: "https://cdn.example.com/video.mp4",
      error: null,
      meta: {},
    });
  });
});
