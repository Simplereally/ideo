const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const MAX_REFERENCE_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;

interface UploadUrlResponse {
  imageUrl?: string;
  error?: string;
}

function buildReferenceImageProxyUrl(imageUrl: string): string {
  return new URL(
    `/api/reference-image?src=${encodeURIComponent(imageUrl)}`,
    window.location.origin,
  ).toString();
}

function extensionForMimeType(mimeType: string): string {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "img";
  }
}

function buildFallbackFileName(file: File): string {
  const ext = extensionForMimeType(file.type);
  return `pasted-${Date.now()}.${ext}`;
}

function assertUploadableReferenceImage(file: File): void {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    throw new Error("Unsupported reference image format");
  }

  if (file.size <= 0) {
    throw new Error("Reference image is empty");
  }

  if (file.size > MAX_REFERENCE_IMAGE_SIZE_BYTES) {
    throw new Error("Reference image is too large (max 20MB)");
  }
}

async function uploadViaReferenceImageApi(file: File): Promise<string> {
  const payload = new FormData();
  payload.append("file", file, file.name?.trim() || buildFallbackFileName(file));

  const response = await fetch("/api/reference-image", {
    method: "POST",
    body: payload,
  });

  const body = (await response.json().catch(() => null)) as UploadUrlResponse | null;

  if (!response.ok || !body?.imageUrl) {
    const message = body?.error || "Failed to upload reference image";
    throw new Error(message);
  }

  return body.imageUrl;
}

async function normalizeViaReferenceImageApi(imageUrl: string): Promise<string> {
  const response = await fetch("/api/reference-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageUrl }),
  });

  const body = (await response.json().catch(() => null)) as UploadUrlResponse | null;

  if (response.ok && body?.imageUrl) {
    return body.imageUrl;
  }

  if (!response.ok && response.status < 500) {
    const message = body?.error || "Failed to normalize reference image URL";
    throw new Error(message);
  }

  return buildReferenceImageProxyUrl(imageUrl);
}

export async function uploadReferenceImage(file: File): Promise<string> {
  assertUploadableReferenceImage(file);
  return uploadViaReferenceImageApi(file);
}

export async function normalizeReferenceImageUrl(imageUrl: string): Promise<string> {
  if (!imageUrl.trim()) {
    throw new Error("Reference image URL is required");
  }

  return normalizeViaReferenceImageApi(imageUrl);
}
