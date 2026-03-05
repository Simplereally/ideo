/**
 * aiml-video.ts — getVideoGeneration BYOK query-param tests
 *
 * Verifies that when an apiKey is supplied, it is appended to the URL
 * as a query parameter so the server proxy can authenticate BYOK users.
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
  it("does NOT include apiKey param when no key is provided", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(okPollBody("gen-1")), { status: 200 }),
    );

    await getVideoGeneration("gen-1");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url] = fetchSpy.mock.calls[0];
    const parsed = new URL(url as string, "http://localhost");
    expect(parsed.searchParams.has("apiKey")).toBe(false);
    expect(parsed.searchParams.get("generation_id")).toBe("gen-1");
  });

  it("does NOT include apiKey param when key is undefined", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(okPollBody("gen-2")), { status: 200 }),
    );

    await getVideoGeneration("gen-2", undefined);

    const [url] = fetchSpy.mock.calls[0];
    const parsed = new URL(url as string, "http://localhost");
    expect(parsed.searchParams.has("apiKey")).toBe(false);
  });

  it("does NOT include apiKey param when key is empty string", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(okPollBody("gen-3")), { status: 200 }),
    );

    await getVideoGeneration("gen-3", "");

    const [url] = fetchSpy.mock.calls[0];
    const parsed = new URL(url as string, "http://localhost");
    expect(parsed.searchParams.has("apiKey")).toBe(false);
  });

  it("includes apiKey query param when a key is provided", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(okPollBody("gen-4")), { status: 200 }),
    );

    await getVideoGeneration("gen-4", "sk-test-key-123");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url] = fetchSpy.mock.calls[0];
    const parsed = new URL(url as string, "http://localhost");
    expect(parsed.searchParams.get("apiKey")).toBe("sk-test-key-123");
    expect(parsed.searchParams.get("generation_id")).toBe("gen-4");
  });

  it("properly encodes special characters in apiKey", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(okPollBody("gen-5")), { status: 200 }),
    );

    const weirdKey = "key+with spaces&special=chars";
    await getVideoGeneration("gen-5", weirdKey);

    const [url] = fetchSpy.mock.calls[0];
    const parsed = new URL(url as string, "http://localhost");
    expect(parsed.searchParams.get("apiKey")).toBe(weirdKey);
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
