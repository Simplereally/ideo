import { NextResponse } from "next/server";
import { generatePresignedUrl, getPublicObjectUrl } from "@/lib/s3";
import crypto from "crypto";

const ALLOWED_IMAGE_CONTENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

function getExtensionFromContentType(contentType: string): string {
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

export async function POST(request: Request) {
  try {
    const { fileName, contentType } = await request.json();

    if (!fileName || !contentType) {
      return NextResponse.json(
        { error: "fileName and contentType are required" },
        { status: 400 }
      );
    }

    if (typeof contentType !== "string" || !ALLOWED_IMAGE_CONTENT_TYPES.has(contentType)) {
      return NextResponse.json(
        { error: "Unsupported content type" },
        { status: 400 },
      );
    }

    // Generate a unique file name to avoid collisions
    const fileExtension =
      typeof fileName === "string" && fileName.includes(".")
        ? fileName.split(".").pop()
        : getExtensionFromContentType(contentType);
    const uniqueId = crypto.randomUUID();
    const safeFileName = `${uniqueId}.${fileExtension}`;

    const url = await generatePresignedUrl(safeFileName, contentType);
    const publicUrl = getPublicObjectUrl(safeFileName) ?? url.split("?")[0];

    return NextResponse.json({ url, publicUrl, fileKey: safeFileName });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate upload URL";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
