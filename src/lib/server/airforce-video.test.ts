import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AirforceVideoProviderError,
  buildAirforceVideoRequest,
  extractAirforceVideoItems,
  isSupportedAirforceVideoModel,
} from "./airforce-video";

const fetchSpy = vi.fn<typeof globalThis.fetch>();

beforeEach(() => {
  fetchSpy.mockReset();
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isSupportedAirforceVideoModel", () => {
  it("accepts the Airforce video models exposed by this app", () => {
    expect(isSupportedAirforceVideoModel("wan-2.6")).toBe(true);
    expect(isSupportedAirforceVideoModel("grok-imagine-video")).toBe(true);
    expect(isSupportedAirforceVideoModel("sora-2")).toBe(true);
    expect(isSupportedAirforceVideoModel("veo-3.1-fast")).toBe(true);
  });

  it("rejects Airforce image models", () => {
    expect(isSupportedAirforceVideoModel("grok-imagine")).toBe(false);
  });
});

describe("buildAirforceVideoRequest", () => {
  describe("wan-2.6", () => {
    it("builds a minimal conservative request", async () => {
      expect(
        await buildAirforceVideoRequest("wan-2.6", {
          prompt: "a cute cat",
          aspectRatio: "9:16",
          duration: 10,
          resolution: "1080P",
          generateAudio: false,
          imageUrl: "https://example.com/cat.png",
        }),
      ).toEqual({
        model: "wan-2.6",
        prompt: "a cute cat",
        sse: true,
        duration: 10,
        resolution: "1080P",
      });
    });

    it("falls back to safe defaults when params are omitted or invalid", async () => {
      expect(
        await buildAirforceVideoRequest("wan-2.6", {
          prompt: "a cute cat",
          duration: 99,
          resolution: "4K",
        }),
      ).toEqual({
        model: "wan-2.6",
        prompt: "a cute cat",
        sse: true,
        duration: 5,
        resolution: "720P",
      });
    });
  });

  describe("grok-imagine-video", () => {
    it("uses image_urls for single-image requests", async () => {
      fetchSpy.mockResolvedValueOnce({ url: "https://cdn.example.com/frame.png" } as Response);

      expect(
        await buildAirforceVideoRequest("grok-imagine-video", {
          prompt: "turn this still into motion",
          imageUrl: "https://example.com/frame.png",
        }),
      ).toEqual({
        model: "grok-imagine-video",
        prompt: "turn this still into motion",
        n: 1,
        response_format: "url",
        sse: true,
        aspectRatio: "2:3",
        image_urls: ["https://cdn.example.com/frame.png"],
      });
    });

    it("uses image_urls and caps the array at two items", async () => {
      fetchSpy
        .mockResolvedValueOnce({ url: "https://cdn.example.com/frame-1.png" } as Response)
        .mockResolvedValueOnce({ url: "https://cdn.example.com/frame-2.png" } as Response);

      expect(
        await buildAirforceVideoRequest("grok-imagine-video", {
          prompt: "blend these into motion",
          aspectRatio: "2:3",
          imageUrls: [
            "https://example.com/frame-1.png",
            "https://example.com/frame-2.png",
            "https://example.com/frame-3.png",
          ],
        }),
      ).toEqual({
        model: "grok-imagine-video",
        prompt: "blend these into motion",
        n: 1,
        response_format: "url",
        sse: true,
        aspectRatio: "2:3",
        image_urls: [
          "https://cdn.example.com/frame-1.png",
          "https://cdn.example.com/frame-2.png",
        ],
      });
    });

    it("falls back to the original image URL when redirect resolution fails", async () => {
      fetchSpy.mockRejectedValueOnce(new Error("network error"));

      expect(
        await buildAirforceVideoRequest("grok-imagine-video", {
          prompt: "keep the original image URL",
          imageUrl: "https://example.com/frame.png",
        }),
      ).toEqual({
        model: "grok-imagine-video",
        prompt: "keep the original image URL",
        n: 1,
        response_format: "url",
        sse: true,
        aspectRatio: "2:3",
        image_urls: ["https://example.com/frame.png"],
      });
    });

    it("maps landscape 1080p requests to the exact Airforce size contract", async () => {
      expect(
        await buildAirforceVideoRequest("grok-imagine-video", {
          prompt: "a cinematic flythrough",
          aspectRatio: "3:2",
          resolution: "1080p",
        }),
      ).toEqual({
        model: "grok-imagine-video",
        prompt: "a cinematic flythrough",
        n: 1,
        response_format: "url",
        sse: true,
        aspectRatio: "3:2",
        size: "1920x1080",
      });
    });

    it("omits size for image-to-video requests while keeping aspectRatio", async () => {
      expect(
        await buildAirforceVideoRequest("grok-imagine-video", {
          prompt: "animate this portrait",
          aspectRatio: "3:2",
          resolution: "1080p",
          imageUrls: ["https://example.com/frame.png"],
        }),
      ).toEqual({
        model: "grok-imagine-video",
        prompt: "animate this portrait",
        n: 1,
        response_format: "url",
        sse: true,
        aspectRatio: "3:2",
        image_urls: ["https://example.com/frame.png"],
      });
    });
  });

  describe("sora-2", () => {
    it("builds a text-to-video request with valid params", async () => {
      expect(
        await buildAirforceVideoRequest("sora-2", {
          prompt: "a majestic eagle soaring",
          aspectRatio: "landscape",
          duration: 15,
        }),
      ).toEqual({
        model: "sora-2",
        prompt: "a majestic eagle soaring",
        sse: true,
        aspectRatio: "landscape",
        duration: 15,
      });
    });

    it("builds an image-to-video request with image_urls", async () => {
      fetchSpy.mockResolvedValueOnce({ url: "https://cdn.example.com/scene.png" } as Response);

      expect(
        await buildAirforceVideoRequest("sora-2", {
          prompt: "animate this scene",
          aspectRatio: "portrait",
          duration: 10,
          imageUrl: "https://example.com/scene.png",
        }),
      ).toEqual({
        model: "sora-2",
        prompt: "animate this scene",
        sse: true,
        aspectRatio: "portrait",
        duration: 10,
        image_urls: ["https://cdn.example.com/scene.png"],
      });
    });
  });

  describe("veo-3.1-fast", () => {
    it("builds a text-to-video request with valid params", async () => {
      expect(
        await buildAirforceVideoRequest("veo-3.1-fast", {
          prompt: "a futuristic cityscape",
          aspectRatio: "16:9",
        }),
      ).toEqual({
        model: "veo-3.1-fast",
        prompt: "a futuristic cityscape",
        sse: true,
        aspectRatio: "16:9",
      });
    });

    it("builds an image-to-video request with start_frame_url", async () => {
      fetchSpy.mockResolvedValueOnce({ url: "https://cdn.example.com/frame.jpg" } as Response);

      expect(
        await buildAirforceVideoRequest("veo-3.1-fast", {
          prompt: "bring this image to life",
          aspectRatio: "9:16",
          imageUrl: "https://example.com/frame.jpg",
        }),
      ).toEqual({
        model: "veo-3.1-fast",
        prompt: "bring this image to life",
        sse: true,
        aspectRatio: "9:16",
        start_frame_url: "https://cdn.example.com/frame.jpg",
      });
    });
  });
});

describe("extractAirforceVideoItems", () => {
  it("extracts the latest data payload from an Airforce SSE stream", () => {
    const raw = [
      "data: {\"data\":[]}",
      "",
      "data: {\"data\":[{\"url\":\"https://example.com/first.mp4\"}]}",
      "",
      "data: {\"data\":[{\"url\":\"https://example.com/final.mp4\"}]}",
      "",
      "data: [DONE]",
    ].join("\n");

    expect(extractAirforceVideoItems(raw)).toEqual([{ url: "https://example.com/final.mp4" }]);
  });

  it("extracts SSE events that include event metadata and the provider's final payload shape", () => {
    const raw = [
      "event: message",
      "data: {\"created\":1773120288,\"data\":[{\"url\":\"https://anondrop.net/1480798552568365168/vid.mp4\",\"b64_json\":null}]}",
      "",
      "data: [DONE]",
    ].join("\r\n");

    expect(extractAirforceVideoItems(raw)).toEqual([
      { url: "https://anondrop.net/1480798552568365168/vid.mp4", b64_json: null },
    ]);
  });

  it("extracts direct JSON video responses", () => {
    expect(
      extractAirforceVideoItems(
        JSON.stringify({
          video_url: "https://example.com/direct.mp4",
        }),
      ),
    ).toEqual([{ url: "https://example.com/direct.mp4" }]);
  });

  it("surfaces upstream Airforce errors", () => {
    try {
      extractAirforceVideoItems(
        JSON.stringify({
          error: {
            message: "upstream failure",
            status: 400,
            details: {
              field: "image_url",
            },
          },
        }),
      );
      throw new Error("Expected extractAirforceVideoItems to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(AirforceVideoProviderError);
      expect((error as AirforceVideoProviderError).message).toBe(
        "upstream failure | {\"field\":\"image_url\"}",
      );
      expect((error as AirforceVideoProviderError).httpStatus).toBe(400);
    }
  });

  describe("defensive SSE parsing", () => {
    it("skips malformed JSON chunks and continues processing", () => {
      const raw = [
        "data: {not valid json",
        "",
        "data: {\"data\":[{\"url\":\"https://example.com/video.mp4\"}]}",
        "",
        "data: [DONE]",
      ].join("\n");

      expect(extractAirforceVideoItems(raw)).toEqual([{ url: "https://example.com/video.mp4" }]);
    });

    it("handles mixed valid and invalid chunks gracefully", () => {
      const raw = [
        "data: {\"data\":[{\"url\":\"https://example.com/first.mp4\"}]}",
        "",
        "data: truncated{",
        "",
        "data: {\"data\":[{\"url\":\"https://example.com/final.mp4\"}]}",
        "",
      ].join("\n");

      expect(extractAirforceVideoItems(raw)).toEqual([{ url: "https://example.com/final.mp4" }]);
    });
  });
});
