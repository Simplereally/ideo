import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeReferenceImageUrl } from "./reference-image-upload";

describe("normalizeReferenceImageUrl", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns the uploaded URL when normalization succeeds", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ imageUrl: "https://cdn.example.com/reference.png" }),
    });

    await expect(
      normalizeReferenceImageUrl("https://example.com/original.png"),
    ).resolves.toBe("https://cdn.example.com/reference.png");
  });

  it("falls back to the same-origin proxy when backend normalization fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "upload failed" }),
    });

    await expect(
      normalizeReferenceImageUrl("https://example.com/original.png"),
    ).resolves.toBe(
      `${window.location.origin}/api/reference-image?src=${encodeURIComponent("https://example.com/original.png")}`,
    );
  });

  it("keeps throwing validation errors from the reference-image API", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Reference image URL is invalid" }),
    });

    await expect(normalizeReferenceImageUrl("notaurl")).rejects.toThrow(
      "Reference image URL is invalid",
    );
  });
});
