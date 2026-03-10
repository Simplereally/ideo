import { describe, expect, it } from "vitest";
import {
  buildAirforceVideoRequest,
  extractAirforceVideoItems,
  isSupportedAirforceVideoModel,
} from "./airforce-video";

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
  describe("wan-2.6 (conservative payload)", () => {
    it("builds a minimal request without undocumented fields", () => {
      expect(
        buildAirforceVideoRequest("wan-2.6", {
          prompt: "a cute cat",
          aspectRatio: "9:16", // ignored - not sent to avoid contract mismatch
          duration: 10,
          resolution: "1080P",
          generateAudio: false, // ignored - sound field is undocumented
          imageUrl: "https://example.com/cat.png", // ignored - no documented i2v field
        }),
      ).toEqual({
        model: "wan-2.6",
        prompt: "a cute cat",
        sse: true,
        duration: 10,
        resolution: "1080P",
      });
    });

    it("falls back to safe defaults when params are omitted or invalid", () => {
      expect(
        buildAirforceVideoRequest("wan-2.6", {
          prompt: "a cute cat",
          duration: 99, // invalid -> fallback
          resolution: "4K", // invalid -> fallback
        }),
      ).toEqual({
        model: "wan-2.6",
        prompt: "a cute cat",
        sse: true,
        duration: 5,
        resolution: "720P",
      });
    });

    it("omits aspectRatio, sound, and wan_image_url (undocumented fields)", () => {
      const request = buildAirforceVideoRequest("wan-2.6", {
        prompt: "test",
        aspectRatio: "16:9",
        generateAudio: true,
        imageUrl: "https://example.com/img.png",
      });
      expect(request).not.toHaveProperty("aspectRatio");
      expect(request).not.toHaveProperty("sound");
      expect(request).not.toHaveProperty("wan_image_url");
    });
  });

  describe("grok-imagine-video", () => {
    it("uses image_urls instead of aspectRatio for image-to-video", () => {
      expect(
        buildAirforceVideoRequest("grok-imagine-video", {
          prompt: "turn this still into motion",
          aspectRatio: "1:1", // ignored when imageUrl is present
          resolution: "720p",
          imageUrl: "https://example.com/frame.png",
        }),
      ).toEqual({
        model: "grok-imagine-video",
        prompt: "turn this still into motion",
        sse: true,
        mode: "normal",
        resolution: "720p",
        image_urls: ["https://example.com/frame.png"],
      });
    });

    it("includes aspectRatio for text-to-video (no imageUrl)", () => {
      expect(
        buildAirforceVideoRequest("grok-imagine-video", {
          prompt: "a sunset over the ocean",
          aspectRatio: "2:3",
          resolution: "480p",
        }),
      ).toEqual({
        model: "grok-imagine-video",
        prompt: "a sunset over the ocean",
        sse: true,
        mode: "normal",
        resolution: "480p",
        aspectRatio: "2:3",
      });
    });

    it("falls back to safe defaults for text-to-video", () => {
      expect(
        buildAirforceVideoRequest("grok-imagine-video", {
          prompt: "test",
        }),
      ).toEqual({
        model: "grok-imagine-video",
        prompt: "test",
        sse: true,
        mode: "normal",
        resolution: "480p",
        aspectRatio: "3:2",
      });
    });
  });

  describe("sora-2", () => {
    it("builds a text-to-video request with valid params", () => {
      expect(
        buildAirforceVideoRequest("sora-2", {
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

    it("builds an image-to-video request with image_urls", () => {
      expect(
        buildAirforceVideoRequest("sora-2", {
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
        image_urls: ["https://example.com/scene.png"],
      });
    });

    it("falls back to safe defaults when params are invalid", () => {
      expect(
        buildAirforceVideoRequest("sora-2", {
          prompt: "test",
          aspectRatio: "16:9", // invalid -> fallback to portrait
          duration: 99, // invalid -> fallback to 10
        }),
      ).toEqual({
        model: "sora-2",
        prompt: "test",
        sse: true,
        aspectRatio: "portrait",
        duration: 10,
      });
    });
  });

  describe("veo-3.1-fast", () => {
    it("builds a text-to-video request with valid params", () => {
      expect(
        buildAirforceVideoRequest("veo-3.1-fast", {
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

    it("builds an image-to-video request with start_frame_url", () => {
      expect(
        buildAirforceVideoRequest("veo-3.1-fast", {
          prompt: "bring this image to life",
          aspectRatio: "9:16",
          imageUrl: "https://example.com/frame.jpg",
        }),
      ).toEqual({
        model: "veo-3.1-fast",
        prompt: "bring this image to life",
        sse: true,
        aspectRatio: "9:16",
        start_frame_url: "https://example.com/frame.jpg",
      });
    });

    it("falls back to safe defaults when params are invalid", () => {
      expect(
        buildAirforceVideoRequest("veo-3.1-fast", {
          prompt: "test",
          aspectRatio: "1:1", // invalid -> fallback to 16:9
        }),
      ).toEqual({
        model: "veo-3.1-fast",
        prompt: "test",
        sse: true,
        aspectRatio: "16:9",
      });
    });

    it("does NOT include image-ish fields (size, n, response_format)", () => {
      const request = buildAirforceVideoRequest("veo-3.1-fast", { prompt: "test" });
      expect(request).not.toHaveProperty("size");
      expect(request).not.toHaveProperty("n");
      expect(request).not.toHaveProperty("response_format");
    });
  });

  it("does NOT include image-ish fields (size, n, response_format) in video requests", () => {
    const wanRequest = buildAirforceVideoRequest("wan-2.6", { prompt: "test" });
    const grokRequest = buildAirforceVideoRequest("grok-imagine-video", { prompt: "test" });
    
    // These fields are appropriate for image models but not video models
    expect(wanRequest).not.toHaveProperty("size");
    expect(wanRequest).not.toHaveProperty("n");
    expect(wanRequest).not.toHaveProperty("response_format");
    
    expect(grokRequest).not.toHaveProperty("size");
    expect(grokRequest).not.toHaveProperty("n");
    expect(grokRequest).not.toHaveProperty("response_format");
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

    expect(extractAirforceVideoItems(raw)).toEqual([
      { url: "https://example.com/final.mp4" },
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
    expect(() =>
      extractAirforceVideoItems(
        JSON.stringify({
          error: {
            message: "upstream failure",
          },
        }),
      ),
    ).toThrow("upstream failure");
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

      expect(extractAirforceVideoItems(raw)).toEqual([
        { url: "https://example.com/video.mp4" },
      ]);
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

      expect(extractAirforceVideoItems(raw)).toEqual([
        { url: "https://example.com/final.mp4" },
      ]);
    });

    it("returns empty array when all chunks are malformed", () => {
      const raw = [
        "data: {broken",
        "",
        "data: also broken}",
        "",
      ].join("\n");

      expect(extractAirforceVideoItems(raw)).toEqual([]);
    });

    it("handles empty payloads gracefully", () => {
      const raw = [
        "data: ",
        "",
        "data: {\"data\":[{\"url\":\"https://example.com/video.mp4\"}]}",
        "",
      ].join("\n");

      expect(extractAirforceVideoItems(raw)).toEqual([
        { url: "https://example.com/video.mp4" },
      ]);
    });
  });
});
