import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/upload", () => ({
  uploadBase64ToR2: vi.fn().mockResolvedValue("https://r2.example.com/image.png"),
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

const mockFetch = vi.fn();
global.fetch = mockFetch;

import { POST } from "./route";

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/generate/airforce", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/generate/airforce", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("surfaces upstream 429 details without retry-looping in the route", async () => {
    const upstreamError = {
      error:
        "Rate limit exceeded (1 request(s) per minute). Try again in 56 seconds. discord.gg/airforce",
    };

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => JSON.stringify(upstreamError),
    });

    const response = await POST(
      makeRequest({
        model: "airforce:grok-imagine",
        prompt: "test prompt",
        aspectRatio: "1:1",
      }),
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error:
        "Rate limit exceeded (1 request(s) per minute). Try again in 56 seconds. discord.gg/airforce",
      upstreamStatus: 429,
      upstreamBody: upstreamError,
    });
  });

  it("returns successful image payloads unchanged", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          data: [{ url: "https://example.com/generated.png" }],
        }),
    });

    const response = await POST(
      makeRequest({
        model: "airforce:grok-imagine",
        prompt: "test prompt",
        aspectRatio: "1:1",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      imageUrl: "https://example.com/generated.png",
      images: [{ imageUrl: "https://example.com/generated.png" }],
    });
  });
});
