/**
 * airforce-video.ts client service tests
 *
 * Verifies that the client-side service correctly:
 * 1. Calls the proxy route and returns successful results
 * 2. Preserves structured diagnostics from error responses (upstreamStatus, upstreamBody, sentRequestBody)
 * 3. Throws AirforceVideoError with diagnostics attached for developer debugging
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createAirforceVideoGeneration,
  AirforceVideoError,
} from "./airforce-video";

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createAirforceVideoGeneration", () => {
  describe("successful generation", () => {
    it("returns video result on success", async () => {
      const mockResult = {
        id: "gen-123",
        status: "completed",
        videoUrl: "https://example.com/video.mp4",
        error: null,
        meta: { model: "wan-2.6" },
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResult), { status: 200 }),
      );

      const result = await createAirforceVideoGeneration({
        model: "wan-2.6",
        params: { prompt: "a cute cat" },
      });

      expect(result).toEqual(mockResult);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("sends grok reference images as image_urls arrays", async () => {
      const mockResult = {
        id: "gen-456",
        status: "completed",
        videoUrl: "https://example.com/video.mp4",
        error: null,
        meta: { model: "grok-imagine-video" },
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResult), { status: 200 }),
      );

      await createAirforceVideoGeneration({
        model: "grok-imagine-video",
        params: {
          prompt: "animate this frame",
          imageUrl: "https://example.com/frame.png",
        },
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [, init] = fetchSpy.mock.calls[0];
      expect(JSON.parse(init?.body as string)).toMatchObject({
        model: "grok-imagine-video",
        image_urls: ["https://example.com/frame.png"],
      });
      expect(JSON.parse(init?.body as string)).not.toHaveProperty("imageUrl");
    });
  });

  describe("error handling with diagnostics", () => {
    it("preserves upstreamStatus and upstreamBody from 400 errors", async () => {
      const errorResponse = {
        error: "Invalid aspect ratio for this model",
        upstreamStatus: 400,
        upstreamBody: { error: { message: "Invalid aspect ratio for this model" }, code: "INVALID_PARAM" },
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(errorResponse), { status: 400 }),
      );

      try {
        await createAirforceVideoGeneration({
          model: "grok-imagine-video",
          params: { prompt: "test" },
        });
        expect.fail("Expected AirforceVideoError to be thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(AirforceVideoError);
        const airforceErr = err as AirforceVideoError;
        expect(airforceErr.message).toBe("Invalid aspect ratio for this model");
        expect(airforceErr.diagnostics.upstreamStatus).toBe(400);
        expect(airforceErr.diagnostics.upstreamBody).toEqual({
          error: { message: "Invalid aspect ratio for this model" },
          code: "INVALID_PARAM",
        });
        expect(airforceErr.diagnostics.sentRequestBody).toBeUndefined();
      }
    });

    it("preserves sentRequestBody from 500 errors for contract debugging", async () => {
      const errorResponse = {
        error: "Internal server error",
        upstreamStatus: 500,
        upstreamBody: "upstream crash",
        sentRequestBody: {
          model: "wan-2.6",
          prompt: "test",
          sse: true,
          duration: 5,
          resolution: "720P",
        },
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(errorResponse), { status: 500 }),
      );

      try {
        await createAirforceVideoGeneration({
          model: "wan-2.6",
          params: { prompt: "test" },
        });
      } catch (err) {
        expect(err).toBeInstanceOf(AirforceVideoError);
        const airforceErr = err as AirforceVideoError;
        expect(airforceErr.message).toBe("Internal server error");
        expect(airforceErr.diagnostics.upstreamStatus).toBe(500);
        expect(airforceErr.diagnostics.sentRequestBody).toEqual({
          model: "wan-2.6",
          prompt: "test",
          sse: true,
          duration: 5,
          resolution: "720P",
        });
      }
    });

    it("handles plain text error responses gracefully", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response("Gateway timeout", { status: 504 }),
      );

      try {
        await createAirforceVideoGeneration({
          model: "sora-2",
          params: { prompt: "test" },
        });
      } catch (err) {
        expect(err).toBeInstanceOf(AirforceVideoError);
        const airforceErr = err as AirforceVideoError;
        expect(airforceErr.message).toBe("Gateway timeout");
        // No structured diagnostics available from plain text
        expect(airforceErr.diagnostics.upstreamStatus).toBeUndefined();
      }
    });

    it("provides fallback message when body is empty", async () => {
      fetchSpy.mockResolvedValueOnce(new Response("", { status: 502 }));

      try {
        await createAirforceVideoGeneration({
          model: "veo-3.1-fast",
          params: { prompt: "test" },
        });
      } catch (err) {
        expect(err).toBeInstanceOf(AirforceVideoError);
        const airforceErr = err as AirforceVideoError;
        expect(airforceErr.message).toBe("Airforce video API returned HTTP 502");
      }
    });

    it("extracts message from nested error.message field", async () => {
      const errorResponse = {
        error: { message: "Model not available" },
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(errorResponse), { status: 503 }),
      );

      try {
        await createAirforceVideoGeneration({
          model: "wan-2.6",
          params: { prompt: "test" },
        });
      } catch (err) {
        expect(err).toBeInstanceOf(AirforceVideoError);
        const airforceErr = err as AirforceVideoError;
        expect(airforceErr.message).toBe("Model not available");
      }
    });

    it("extracts message from detail field", async () => {
      const errorResponse = {
        detail: "Rate limit exceeded",
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(errorResponse), { status: 429 }),
      );

      try {
        await createAirforceVideoGeneration({
          model: "grok-imagine-video",
          params: { prompt: "test" },
        });
      } catch (err) {
        expect(err).toBeInstanceOf(AirforceVideoError);
        const airforceErr = err as AirforceVideoError;
        expect(airforceErr.message).toBe("Rate limit exceeded");
      }
    });
  });
});
