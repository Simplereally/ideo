import { generatePresignedUrl, getPublicObjectUrl } from "@/lib/s3";

// ---------------------------------------------------------------------------
// Server-side helper: upload a base64-encoded image to R2, return public URL.
// Shared by any provider route that receives base64 from upstream.
// ---------------------------------------------------------------------------

/**
 * Upload raw bytes to R2 via a presigned PUT URL.
 *
 * @returns The public object URL (presigned URL stripped of query params).
 */
export async function uploadBufferToR2(
  bytes: Uint8Array,
  contentType: string,
  ext: string,
): Promise<string> {
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const presignedUrl = await generatePresignedUrl(fileName, contentType);

  // Copy into a clean ArrayBuffer so fetch accepts it without TS grief.
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);

  // Abort after 30 seconds to avoid hanging on slow/unresponsive R2 endpoints.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  let res: Response;
  try {
    res = await fetch(presignedUrl, {
      method: "PUT",
      body: ab,
      headers: { "Content-Type": contentType },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    throw new Error(`R2 PUT failed: ${res.status} ${res.statusText}`);
  }

  // Prefer the configured public URL; fall back to the presigned URL sans query.
  return getPublicObjectUrl(fileName) ?? presignedUrl.split("?")[0];
}

/**
 * Decode a base64 string and upload to R2.
 *
 * @returns The public object URL, or a data-URL fallback if upload fails and
 *          `fallback` is true (default).
 */
export async function uploadBase64ToR2(
  base64: string,
  contentType: string,
  ext: string,
  fallback = true,
): Promise<string> {
  const buffer = Buffer.from(base64, "base64");
  const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  try {
    return await uploadBufferToR2(bytes, contentType, ext);
  } catch (err) {
    if (fallback) {
      console.warn("[upload] R2 upload failed, returning data URL", err);
      return `data:${contentType};base64,${base64}`;
    }
    throw err;
  }
}
