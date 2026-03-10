import { NextResponse } from "next/server";
import { uploadBufferToR2 } from "@/lib/server/upload";

const ALLOWED_IMAGE_CONTENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const MAX_REFERENCE_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;

type ReferenceImageBackend = "auto" | "r2" | "anondrop";

let cachedAnonDropKey: string | null = null;

function normalizeBackend(rawValue: string | undefined): ReferenceImageBackend {
  const normalized = rawValue?.trim().toLowerCase();
  if (normalized === "r2" || normalized === "anondrop") return normalized;
  return "auto";
}

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

async function uploadRemoteReferenceImage(imageUrl: string): Promise<string> {
  if (isManagedReferenceImageUrl(imageUrl)) {
    return imageUrl;
  }
  const { contentType, bytes } = await fetchRemoteReferenceImage(imageUrl);
  return uploadReferenceImageBytes(bytes, contentType);
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

function extractUrlsFromText(rawText: string): string[] {
  const matches = rawText.match(/https?:\/\/[^\s"'<>]+/gi) ?? [];
  return Array.from(new Set(matches));
}

function isKnownAnonDropStaticAssetPath(path: string): boolean {
  return (
    /^\/(?:logo|favicon|apple-touch-icon)(?:[-\w]*)\.(?:png|jpe?g|webp|gif|svg|ico)$/i.test(path) ||
    path.startsWith("/_next/") ||
    path.startsWith("/assets/")
  );
}

function isAnonDropGeneratedFilePath(path: string, searchParams: URLSearchParams): boolean {
  if (
    path.includes("/download") ||
    path.includes("/file") ||
    path.includes("/f/") ||
    searchParams.get("download") === "true"
  ) {
    return true;
  }

  const segments = path.split("/").filter(Boolean);
  return segments.length >= 2 && /\.(png|jpe?g|webp|gif|bmp|tiff|avif|svg)$/i.test(path);
}

function isAnonDropFilePagePath(path: string): boolean {
  const segments = path.split("/").filter(Boolean);
  return segments.length === 1 && /^\d+$/.test(segments[0] ?? "");
}

export function isLikelyUploadedFileUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();

    if (!parsed.hostname.endsWith("anondrop.net")) {
      if (/\.(png|jpe?g|webp|gif|bmp|tiff|avif|svg)$/.test(path)) return true;
      if (
        path.includes("/download") ||
        path.includes("/file") ||
        path.includes("/f/") ||
        parsed.searchParams.get("download") === "true"
      ) {
        return true;
      }
      return false;
    }

    if (isKnownAnonDropStaticAssetPath(path)) {
      return false;
    }

    if (
      isAnonDropGeneratedFilePath(path, parsed.searchParams)
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export function isAnonDropFilePageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();

    return parsed.hostname.endsWith("anondrop.net") && isAnonDropFilePagePath(path);
  } catch {
    return false;
  }
}

export function isDirectAnonDropFileUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();

    return (
      parsed.hostname.endsWith("anondrop.net") &&
      !isKnownAnonDropStaticAssetPath(path) &&
      isAnonDropGeneratedFilePath(path, parsed.searchParams)
    );
  } catch {
    return false;
  }
}

function normalizeDirectAnonDropFileUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("anondrop.net")) return url;

    parsed.searchParams.delete("download");
    return parsed.toString();
  } catch {
    return url;
  }
}

function buildAnonDropPublicUrlFromFileRecord(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id.trim() : String(record.id ?? "").trim();
  if (!/^\d+$/.test(id)) {
    return null;
  }

  const name = typeof record.name === "string" ? record.name.trim() : "";
  if (!name) {
    return `https://anondrop.net/${id}`;
  }

  return `https://anondrop.net/${id}/${encodeURIComponent(name)}`;
}

function extractAnonDropDownloadUrl(rawText: string, baseUrl: string): string | null {
  const urls = extractUrlsFromText(rawText);
  for (const candidate of urls) {
    if (isDirectAnonDropFileUrl(candidate)) return candidate;
  }

  for (const match of rawText.matchAll(/href\s*=\s*(["'])(.*?)\1/gi)) {
    const href = match[2];
    if (!href) continue;

    try {
      const resolved = new URL(href, baseUrl).toString();
      if (isDirectAnonDropFileUrl(resolved)) return resolved;
    } catch {
      continue;
    }
  }

  return null;
}

async function normalizeAnonDropUrl(url: string): Promise<string> {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("anondrop.net")) return url;
  } catch {
    return url;
  }

  if (isDirectAnonDropFileUrl(url)) return normalizeDirectAnonDropFileUrl(url);

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) return url;

  const rawText = await response.text();
  return normalizeDirectAnonDropFileUrl(extractAnonDropDownloadUrl(rawText, url) ?? url);
}

export function extractLikelyFileUrl(payload: unknown): string | null {
  if (typeof payload === "string") {
    const urls = extractUrlsFromText(payload);
    return (
      urls.find((url) => isLikelyUploadedFileUrl(url) || isAnonDropFilePageUrl(url)) ??
      (isAnonDropFilePageUrl(payload.trim()) ? payload.trim() : null)
    );
  }

  if (Array.isArray(payload)) {
    for (const entry of payload) {
      const nested = extractLikelyFileUrl(entry);
      if (nested) return nested;
    }
    return null;
  }

  if (payload && typeof payload === "object") {
    const directUrl = buildAnonDropPublicUrlFromFileRecord(payload);
    if (directUrl) {
      return directUrl;
    }

    for (const value of Object.values(payload as Record<string, unknown>)) {
      const nested = extractLikelyFileUrl(value);
      if (nested) return nested;
    }
  }

  return null;
}

async function resolveAnonDropUserKey(): Promise<string> {
  const configured = process.env.ANONDROP_USER_KEY?.trim();
  if (configured) return configured;
  if (cachedAnonDropKey) return cachedAnonDropKey;

  const response = await fetch("https://anondrop.net/register", {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`AnonDrop register failed with status ${response.status}`);
  }

  const html = await response.text();
  const keyMatch =
    html.match(/localStorage\.setItem\('userkey',\s*'([^']+)'\)/) ??
    html.match(/localStorage\.setItem\("userkey",\s*"([^"]+)"\)/);

  if (!keyMatch?.[1]) {
    throw new Error("AnonDrop register response did not return a user key");
  }

  cachedAnonDropKey = keyMatch[1];
  return cachedAnonDropKey;
}

async function uploadToAnonDrop(file: File): Promise<string> {
  const key = await resolveAnonDropUserKey();

  const payload = new FormData();
  payload.append("file", file, file.name || `reference-${Date.now()}.png`);

  const uploadResponse = await fetch(
    `https://anondrop.net/upload?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      body: payload,
    },
  );

  const rawUploadBody = await uploadResponse.text();

  if (!uploadResponse.ok) {
    throw new Error(
      `AnonDrop upload failed with status ${uploadResponse.status}: ${rawUploadBody.slice(0, 200)}`,
    );
  }

  const directUrl = extractLikelyFileUrl(rawUploadBody);
  if (directUrl) {
    return normalizeAnonDropUrl(directUrl);
  }

  let parsedUploadBody: unknown;
  try {
    parsedUploadBody = JSON.parse(rawUploadBody);
  } catch {
    parsedUploadBody = null;
  }

  const parsedUrl = extractLikelyFileUrl(parsedUploadBody);
  if (parsedUrl) {
    return normalizeAnonDropUrl(parsedUrl);
  }

  const filesResponse = await fetch(
    `https://anondrop.net/files?key=${encodeURIComponent(key)}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  if (!filesResponse.ok) {
    throw new Error(`AnonDrop file lookup failed with status ${filesResponse.status}`);
  }

  const filesPayload = (await filesResponse.json().catch(() => null)) as unknown;
  const listUrl = extractLikelyFileUrl(filesPayload);
  if (listUrl) {
    return normalizeAnonDropUrl(listUrl);
  }

  throw new Error("AnonDrop upload succeeded but no public file URL was returned");
}

async function uploadToR2(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = extensionFromContentType(file.type);
  return uploadBufferToR2(bytes, file.type, ext);
}

function createReferenceFile(
  bytes: Uint8Array,
  contentType: string,
  fileName?: string,
): File {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);

  return new File(
    [buffer],
    fileName ?? `reference-${Date.now()}.${extensionFromContentType(contentType)}`,
    { type: contentType },
  );
}

async function uploadWithConfiguredBackend(file: File): Promise<string> {
  const backend = normalizeBackend(process.env.REFERENCE_IMAGE_UPLOAD_BACKEND);

  if (backend === "r2") {
    return uploadToR2(file);
  }

  if (backend === "anondrop") {
    return uploadToAnonDrop(file);
  }

  try {
    return await uploadToR2(file);
  } catch (error) {
    console.warn("[reference-image] R2 upload failed, falling back to AnonDrop", error);
    return uploadToAnonDrop(file);
  }
}

async function uploadReferenceImage(file: File): Promise<string> {
  return uploadWithConfiguredBackend(file);
}

async function uploadReferenceImageBytes(
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {
  return uploadWithConfiguredBackend(createReferenceFile(bytes, contentType));
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

    const imageUrl = await uploadReferenceImage(file);
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
