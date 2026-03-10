import { NextResponse } from "next/server";
import { uploadBufferToR2 } from "@/lib/server/upload";

const ALLOWED_IMAGE_CONTENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const MAX_REFERENCE_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;

function trimEnv(value: string | undefined): string {
  return value?.trim() ?? "";
}

function isManagedReferenceImageUrl(url: string): boolean {
  const managedBases = [
    trimEnv(process.env.R2_DEV_URL),
    trimEnv(process.env.NEXT_PUBLIC_R2_PUBLIC_URL),
  ].filter(Boolean);

  return managedBases.some((base) => url.startsWith(base.replace(/\/+$/, "")));
}

function extensionFromContentType(contentType: string): string {
  switch (contentType) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "bin";
  }
}

function normalizeContentType(contentType: string | null): string {
  return contentType?.split(";")[0].trim().toLowerCase() ?? "";
}

function assertAllowedRemoteImageType(contentType: string): void {
  if (!ALLOWED_IMAGE_CONTENT_TYPES.has(contentType)) {
    throw new Error("Reference image URL must resolve to a PNG, JPEG, WebP, or GIF");
  }
}

function assertAllowedRemoteImageSize(size: number): void {
  if (size <= 0) {
    throw new Error("Reference image is empty");
  }
  if (size > MAX_REFERENCE_IMAGE_SIZE_BYTES) {
    throw new Error("Reference image is too large (max 20MB)");
  }
}

async function fetchRemoteReferenceImage(imageUrl: string): Promise<{
  contentType: string;
  bytes: Uint8Array;
}> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    throw new Error("Reference image URL is invalid");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("Reference image URL must use http or https");
  }

  const response = await fetch(parsedUrl.toString(), {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Reference image fetch failed with status ${response.status}`);
  }

  const contentType = normalizeContentType(response.headers.get("content-type"));
  assertAllowedRemoteImageType(contentType);

  const contentLength = response.headers.get("content-length");
  if (contentLength) {
    const declaredSize = Number.parseInt(contentLength, 10);
    if (!Number.isNaN(declaredSize)) {
      assertAllowedRemoteImageSize(declaredSize);
    }
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  assertAllowedRemoteImageSize(bytes.byteLength);

  return { contentType, bytes };
}

async function uploadToR2(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = extensionFromContentType(file.type);
  return uploadBufferToR2(bytes, file.type, ext);
}

async function uploadReferenceImageBytes(
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {
  const ext = extensionFromContentType(contentType);
  return uploadBufferToR2(bytes, contentType, ext);
}

async function uploadRemoteReferenceImage(imageUrl: string): Promise<string> {
  if (isManagedReferenceImageUrl(imageUrl)) {
    return imageUrl;
  }
  const { contentType, bytes } = await fetchRemoteReferenceImage(imageUrl);
  return uploadReferenceImageBytes(bytes, contentType);
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { imageUrl?: string };
      if (!body.imageUrl || typeof body.imageUrl !== "string") {
        return NextResponse.json({ error: "Expected JSON body with imageUrl" }, { status: 400 });
      }

      const imageUrl = await uploadRemoteReferenceImage(body.imageUrl);
      return NextResponse.json({ imageUrl });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Expected form-data field 'file'" }, { status: 400 });
    }

    if (!ALLOWED_IMAGE_CONTENT_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: "Reference image is empty" }, { status: 400 });
    }

    const imageUrl = await uploadToR2(file);
    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error("[reference-image] upload failed", error);
    const message =
      error instanceof Error ? error.message : "Failed to upload reference image";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const src = searchParams.get("src")?.trim();

    if (!src) {
      return NextResponse.json({ error: "Missing src query parameter" }, { status: 400 });
    }

    const { contentType, bytes } = await fetchRemoteReferenceImage(src);
    const responseBody = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(responseBody).set(bytes);
    return new Response(responseBody, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to proxy reference image";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
