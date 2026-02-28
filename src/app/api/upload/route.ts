import { NextResponse } from "next/server";
import { generatePresignedUrl } from "@/lib/s3";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const { fileName, contentType } = await request.json();

    if (!fileName || !contentType) {
      return NextResponse.json(
        { error: "fileName and contentType are required" },
        { status: 400 }
      );
    }

    // Generate a unique file name to avoid collisions
    const fileExtension = fileName.split(".").pop();
    const uniqueId = crypto.randomUUID();
    const safeFileName = `${uniqueId}.${fileExtension}`;

    const url = await generatePresignedUrl(safeFileName, contentType);

    return NextResponse.json({ url, fileKey: safeFileName });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
