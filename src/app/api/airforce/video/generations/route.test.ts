import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock the dependencies before importing the route
vi.mock("@/lib/server/upload", () => ({
  uploadBase64ToR2: vi.fn().mockResolvedValue("https://r2.example.com/video.mp4"),
}));

vi.mock("@/lib/server/model-allowlist", () => ({
  isAllowedModel: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/server/rate-limit", () => ({
  generationLimiter: vi.fn().mockReturnValue({ allowed: true }),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
  rateLimitResponse: vi.fn(),
}));

vi.mock("@/lib/server/resolve-keys", () => ({
  resolveApiKey: vi.fn().mockReturnValue({ ok: true, value: "test-api-key" }),
}));

vi.mock("@/lib/server/extract-credentials", () => ({
  extractApiKey: vi.fn().mockReturnValue(undefined),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { POST } from "./route";

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/airforce/video/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/airforce/video/generations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("error surfacing", () => {
    it("surfaces structured upstream error with JSON body for 400s", async () => {
      const upstreamError = {
        error: { message: "Invalid aspect ratio for this model" },
        code: "INVALID_PARAM",
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => JSON.stringify(upstreamError),
      });

      const res = await POST(
        makeRequest({
          model: "grok-imagine-video",
          prompt: "test prompt",
        }),
      );

      expect(res.status).toBe(400);
      const body = await res.json();

      // Should include human-readable message
      expect(body.error).toBe("Invalid aspect ratio for this model");
      // Should include upstream status
      expect(body.upstreamStatus).toBe(400);
      // Should include full upstream body for diagnostics
      expect(body.upstreamBody).toEqual(upstreamError);
      // 400s should NOT include sentRequestBody (only 500s do)
      expect(body).not.toHaveProperty("sentRequestBody");
    });

    it("surfaces plain text upstream errors with request body for 500s", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal server error: model overloaded",
      });

      const res = await POST(
        makeRequest({
          model: "wan-2.6",
          prompt: "test prompt",
        }),
      );

      expect(res.status).toBe(500);
      const body = await res.json();

      expect(body.error).toBe("Internal server error: model overloaded");
      expect(body.upstreamStatus).toBe(500);
      // 500s should include the sent request body for contract debugging
      expect(body.sentRequestBody).toEqual({
        model: "wan-2.6",
        prompt: "test prompt",
        sse: true,
        duration: 5,
        resolution: "720P",
      });
    });

    it("handles empty upstream error bodies gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: async () => "",
      });

      const res = await POST(
        makeRequest({
          model: "grok-imagine-video",
          prompt: "test prompt",
        }),
      );

      expect(res.status).toBe(502);
      const body = await res.json();

      expect(body.error).toBe("Airforce API returned HTTP 502");
      expect(body.upstreamStatus).toBe(502);
      // 502 is a 500-class error, should include sent request
      expect(body.sentRequestBody).toBeDefined();
    });

    it("surfaces string error field from upstream", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: "prompt too long" }),
      });

      const res = await POST(
        makeRequest({
          model: "grok-imagine-video",
          prompt: "test prompt",
        }),
      );

      expect(res.status).toBe(400);
      const body = await res.json();

      expect(body.error).toBe("prompt too long");
    });

    it("adds a targeted hint for opaque grok image-to-video 400s", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        url: "https://pub.example.com/reference.jpg",
      });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: "Provider error (400 Bad Request)" }),
      });

      const res = await POST(
        makeRequest({
          model: "grok-imagine-video",
          prompt: "celestial beauty, shimmering otherwordly divine femininity",
          aspectRatio: "3:2",
          image_urls: ["https://pub.example.com/reference.jpg"],
        }),
      );

      expect(res.status).toBe(400);
      const body = await res.json();

      expect(body.error).toContain("Provider error (400 Bad Request)");
      expect(body.error).toContain("specific prompt and reference-image combinations");
    });
  });

  describe("model-specific request shaping", () => {
    it("sends grok-imagine-video requests with the Airforce size contract", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({ data: [{ url: "https://example.com/video.mp4" }] }),
      });

      await POST(
        makeRequest({
          model: "grok-imagine-video",
          prompt: "a beautiful sunset",
          aspectRatio: "3:2",
          resolution: "720p",
        }),
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [, options] = mockFetch.mock.calls[0];
      const sentBody = JSON.parse(options.body);

      expect(sentBody.model).toBe("grok-imagine-video");
      expect(sentBody.prompt).toBe("a beautiful sunset");
      expect(sentBody.aspectRatio).toBe("3:2");
      expect(sentBody.size).toBe("1280x720");
      expect(sentBody.sse).toBe(true);
      expect(sentBody.n).toBe(1);
      expect(sentBody.response_format).toBe("url");
    });

    it("sends wan-2.6 requests with minimal conservative payload", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({ data: [{ url: "https://example.com/video.mp4" }] }),
      });

      await POST(
        makeRequest({
          model: "wan-2.6",
          prompt: "dancing robots",
          aspectRatio: "16:9", // ignored - not sent
          duration: 10,
          resolution: "1080P",
          generateAudio: true, // ignored - sound field is undocumented
        }),
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [, options] = mockFetch.mock.calls[0];
      const sentBody = JSON.parse(options.body);

      // Should have minimal video-specific fields
      expect(sentBody.model).toBe("wan-2.6");
      expect(sentBody.prompt).toBe("dancing robots");
      expect(sentBody.duration).toBe(10);
      expect(sentBody.resolution).toBe("1080P");
      expect(sentBody.sse).toBe(true);

      // Should NOT have undocumented fields that may cause contract mismatches
      expect(sentBody).not.toHaveProperty("aspectRatio");
      expect(sentBody).not.toHaveProperty("sound");
      expect(sentBody).not.toHaveProperty("wan_image_url");
      expect(sentBody).not.toHaveProperty("size");
      expect(sentBody).not.toHaveProperty("n");
      expect(sentBody).not.toHaveProperty("response_format");
    });

    it("sends grok-imagine-video image-to-video with image_urls", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        url: "https://cdn.example.com/cat.jpg",
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({ data: [{ url: "https://example.com/video.mp4" }] }),
      });

      await POST(
        makeRequest({
          model: "grok-imagine-video",
          prompt: "make the cat dance",
          imageUrl: "https://example.com/cat.jpg",
          aspectRatio: "16:9", // invalid for Grok; should normalize to the safe default
        }),
      );

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const [, options] = mockFetch.mock.calls[1];
      const sentBody = JSON.parse(options.body);

      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        "https://example.com/cat.jpg",
        expect.objectContaining({
          method: "HEAD",
          redirect: "follow",
        }),
      );
      expect(sentBody.model).toBe("grok-imagine-video");
      expect(sentBody.prompt).toBe("make the cat dance");
      expect(sentBody.aspectRatio).toBe("2:3");
      expect(sentBody.sse).toBe(true);
      expect(sentBody.image_urls).toEqual(["https://cdn.example.com/cat.jpg"]);
      expect(sentBody).not.toHaveProperty("size");
    });

    it("accepts image_urls arrays from the client for grok-imagine-video", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        url: "https://cdn.example.com/cat.jpg",
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({ data: [{ url: "https://example.com/video.mp4" }] }),
      });

      await POST(
        makeRequest({
          model: "grok-imagine-video",
          prompt: "make the cat dance",
          image_urls: ["https://example.com/cat.jpg"],
        }),
      );

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const [, options] = mockFetch.mock.calls[1];
      const sentBody = JSON.parse(options.body);

      expect(sentBody.image_urls).toEqual(["https://cdn.example.com/cat.jpg"]);
      expect(sentBody.aspectRatio).toBe("2:3");
      expect(sentBody).not.toHaveProperty("size");
    });

    it("passes through at most two grok image_urls from the client", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({ data: [{ url: "https://example.com/video.mp4" }] }),
      });

      await POST(
        makeRequest({
          model: "grok-imagine-video",
          prompt: "make the cat dance",
          image_urls: [
            "https://example.com/cat-1.jpg",
            "https://example.com/cat-2.jpg",
            "https://example.com/cat-3.jpg",
          ],
        }),
      );

      expect(mockFetch).toHaveBeenCalledTimes(3);
      const [, options] = mockFetch.mock.calls[2];
      const sentBody = JSON.parse(options.body);

      expect(sentBody.image_urls).toEqual([
        "https://example.com/cat-1.jpg",
        "https://example.com/cat-2.jpg",
      ]);
      expect(sentBody.aspectRatio).toBe("2:3");
      expect(sentBody).not.toHaveProperty("size");
    });
  });

  describe("success path", () => {
    it("returns completed result cleanly on successful generation", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({ data: [{ url: "https://example.com/generated-video.mp4" }] }),
      });

      const res = await POST(
        makeRequest({
          model: "grok-imagine-video",
          prompt: "a serene mountain landscape",
        }),
      );

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.status).toBe("completed");
      expect(body.videoUrl).toBe("https://example.com/generated-video.mp4");
      expect(body.id).toBeDefined();
      expect(body.error).toBeNull();
      expect(body).not.toHaveProperty("upstreamStatus");
      expect(body).not.toHaveProperty("upstreamBody");
    });
  });
});
