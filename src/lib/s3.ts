import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let cachedS3Client: S3Client | null = null;

function trimEnv(value: string | undefined): string {
  return value?.trim() ?? "";
}

function getDevUploadBaseUrl(): string {
  return trimEnv(process.env.R2_DEV_URL);
}

function getPublicObjectBaseUrl(): string {
  return trimEnv(process.env.NEXT_PUBLIC_R2_PUBLIC_URL);
}

function getConfiguredBucketName(): string {
  const bucketName = trimEnv(process.env.R2_BUCKET_NAME);
  if (!bucketName) {
    throw new Error("R2 is not configured: missing R2_BUCKET_NAME");
  }
  return bucketName;
}

function getConfiguredS3Client(): S3Client {
  if (cachedS3Client) return cachedS3Client;

  const endpoint = trimEnv(process.env.R2_ENDPOINT);
  const accessKeyId = trimEnv(process.env.R2_ACCESS_KEY_ID);
  const secretAccessKey = trimEnv(process.env.R2_SECRET_ACCESS_KEY);

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 is not configured: set R2_DEV_URL for local uploads, or configure R2_ENDPOINT, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY",
    );
  }

  cachedS3Client = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return cachedS3Client;
}

function joinUrl(baseUrl: string, fileName: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${encodeURIComponent(fileName)}`;
}

export function getPublicObjectUrl(fileName: string): string | null {
  const publicBase = getPublicObjectBaseUrl() || getDevUploadBaseUrl();
  if (!publicBase) return null;
  return joinUrl(publicBase, fileName);
}

export async function generatePresignedUrl(fileName: string, contentType: string) {
  const devUploadBaseUrl = getDevUploadBaseUrl();
  if (devUploadBaseUrl) {
    return joinUrl(devUploadBaseUrl, fileName);
  }

  const command = new PutObjectCommand({
    Bucket: getConfiguredBucketName(),
    Key: fileName,
    ContentType: contentType,
  });

  // URL expires in 15 minutes (900 seconds)
  return getSignedUrl(getConfiguredS3Client(), command, { expiresIn: 900 });
}
