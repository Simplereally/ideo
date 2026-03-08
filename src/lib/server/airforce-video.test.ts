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
  it("builds the Wan 2.6 request with the documented Airforce fields", () => {
    expect(
      buildAirforceVideoRequest("wan-2.6", {
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
      n: 1,
      response_format: "url",
      sse: true,
      size: "1024x1024",
      aspectRatio: "9:16",
      duration: 10,
      resolution: "1080P",
      sound: false,
      wan_image_url: "https://example.com/cat.png",
    });
  });

  it("falls back to the official Wan defaults when params are omitted or invalid", () => {
    expect(
      buildAirforceVideoRequest("wan-2.6", {
        prompt: "a cute cat",
        aspectRatio: "1:1",
        duration: 99,
        resolution: "4K",
      }),
    ).toEqual({
      model: "wan-2.6",
      prompt: "a cute cat",
      n: 1,
      response_format: "url",
      sse: true,
      size: "1024x1024",
      aspectRatio: "16:9",
      duration: 5,
      resolution: "720P",
      sound: true,
    });
  });

  it("uses image_urls instead of aspectRatio for grok-imagine-video image-to-video", () => {
    expect(
      buildAirforceVideoRequest("grok-imagine-video", {
        prompt: "turn this still into motion",
        aspectRatio: "1:1",
        resolution: "720p",
        imageUrl: "https://example.com/frame.png",
      }),
    ).toEqual({
      model: "grok-imagine-video",
      prompt: "turn this still into motion",
      n: 1,
      response_format: "url",
      sse: true,
      size: "1024x1024",
      mode: "normal",
      resolution: "720p",
      image_urls: ["https://example.com/frame.png"],
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
});
