import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/server/upload", () => ({
  uploadBufferToR2: vi.fn(async () => "https://pub-1cbcf4561977402ea654a6fdc54f09db.r2.dev/test-uuid.png"),
}));

import { POST, GET } from "./route";
import { uploadBufferToR2 } from "@/lib/server/upload";

const originalFetch = globalThis.fetch;

function createJsonRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/reference-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/reference-image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("passes through managed R2 URLs without re-uploading", async () => {
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL = "https://pub-1cbcf4561977402ea654a6fdc54f09db.r2.dev";

    const res = await POST(
      createJsonRequest({
        imageUrl: "https://pub-1cbcf4561977402ea654a6fdc54f09db.r2.dev/existing.png",
      }),
    );

    const json = (await res.json()) as { imageUrl: string };
    expect(res.status).toBe(200);
    expect(json.imageUrl).toBe(
      "https://pub-1cbcf4561977402ea654a6fdc54f09db.r2.dev/existing.png",
    );
    expect(uploadBufferToR2).not.toHaveBeenCalled();
  });

  it("re-uploads remote URLs to R2", async () => {
    const pngBytes = new Uint8Array([137, 80, 78, 71]);
    globalThis.fetch = vi.fn(async () =>
      new Response(pngBytes, {
        status: 200,
        headers: { "Content-Type": "image/png", "Content-Length": "4" },
      }),
    ) as typeof fetch;

    const res = await POST(
      createJsonRequest({ imageUrl: "https://example.com/photo.png" }),
    );

    const json = (await res.json()) as { imageUrl: string };
    expect(res.status).toBe(200);
    expect(json.imageUrl).toContain("r2.dev");
    expect(uploadBufferToR2).toHaveBeenCalledOnce();
  });

  it("rejects JSON without imageUrl", async () => {
    const res = await POST(createJsonRequest({}));
    expect(res.status).toBe(400);

    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Expected JSON body with imageUrl");
  });

  it("returns 500 when remote fetch fails", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("Not Found", { status: 404 }),
    ) as typeof fetch;

    const res = await POST(
      createJsonRequest({ imageUrl: "https://example.com/missing.png" }),
    );

    expect(res.status).toBe(500);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain("failed with status 404");
  });

  it("rejects remote images with unsupported content type", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(new Uint8Array([0]), {
        status: 200,
        headers: { "Content-Type": "image/bmp" },
      }),
    ) as typeof fetch;

    const res = await POST(
      createJsonRequest({ imageUrl: "https://example.com/photo.bmp" }),
    );

    expect(res.status).toBe(500);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain("PNG, JPEG, WebP, or GIF");
  });
});

describe("GET /api/reference-image", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("proxies a remote image", async () => {
    const pngBytes = new Uint8Array([137, 80, 78, 71]);
    globalThis.fetch = vi.fn(async () =>
      new Response(pngBytes, {
        status: 200,
        headers: { "Content-Type": "image/png" },
      }),
    ) as typeof fetch;

    const req = new Request(
      "http://localhost/api/reference-image?src=https://example.com/img.png",
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
  });

  it("returns 400 when src is missing", async () => {
    const req = new Request("http://localhost/api/reference-image");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});
