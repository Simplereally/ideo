import { describe, expect, it } from "vitest";
import {
  extractLikelyFileUrl,
  isAnonDropFilePageUrl,
  isDirectAnonDropFileUrl,
  isLikelyUploadedFileUrl,
} from "./route";

describe("reference-image AnonDrop URL detection", () => {
  it("rejects the AnonDrop logo asset as an uploaded file", () => {
    expect(isLikelyUploadedFileUrl("https://anondrop.net/logo.jpg")).toBe(false);
    expect(isDirectAnonDropFileUrl("https://anondrop.net/logo.jpg")).toBe(false);
  });

  it("accepts real AnonDrop file URLs", () => {
    expect(
      isLikelyUploadedFileUrl("https://anondrop.net/1480798552568365168/frame.png"),
    ).toBe(true);
    expect(
      isDirectAnonDropFileUrl("https://anondrop.net/1480798552568365168/frame.png"),
    ).toBe(true);
  });

  it("recognizes AnonDrop file page URLs returned by direct upload", () => {
    expect(isAnonDropFilePageUrl("https://anondrop.net/1480822125936775340")).toBe(true);
    expect(
      extractLikelyFileUrl(
        "File Link: <a href='https://anondrop.net/1480822125936775340'>https://anondrop.net/1480822125936775340</a>",
      ),
    ).toBe("https://anondrop.net/1480822125936775340");
  });

  it("extracts the real uploaded file URL instead of the site logo", () => {
    const payload = {
      logo: "https://anondrop.net/logo.jpg",
      file: "https://anondrop.net/1480798552568365168/frame.png",
    };

    expect(extractLikelyFileUrl(payload)).toBe(
      "https://anondrop.net/1480798552568365168/frame.png",
    );
  });

  it("builds a usable public URL from the /files API payload", () => {
    expect(
      extractLikelyFileUrl({
        files: [
          {
            id: "1480822125936775340",
            name: "frame.png",
          },
        ],
      }),
    ).toBe("https://anondrop.net/1480822125936775340/frame.png");
  });

  it("returns null when the payload only contains boilerplate asset URLs", () => {
    expect(
      extractLikelyFileUrl({
        logo: "https://anondrop.net/logo.jpg",
        favicon: "https://anondrop.net/favicon.ico",
      }),
    ).toBeNull();
  });
});
