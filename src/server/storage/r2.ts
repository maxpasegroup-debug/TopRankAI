import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getEnv } from "../env";

/**
 * Cloudflare R2 storage.
 *
 * R2 speaks the S3 API, so the AWS SDK is pointed at the account's R2 endpoint.
 * Uploads are proxied through a route handler rather than presigned URLs: the
 * browser never sees the credentials, the bucket needs no CORS rule, and the
 * MIME type and byte size are checked before anything is written.
 *
 * Required environment (see .env.example):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET,
 *   R2_PUBLIC_BASE_URL
 *
 * `R2_PUBLIC_BASE_URL` is what the browser uses to read a file: either the
 * bucket's r2.dev development URL or a custom domain connected to the bucket.
 */

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export type ImageType = { mime: "image/jpeg" | "image/png" | "image/webp"; extension: "jpg" | "png" | "webp" };

export type StorageStatus =
  | { configured: true }
  | { configured: false; missing: string[] };

type StorageConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
};

const required = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_BASE_URL",
] as const;

function storageConfig(): StorageConfig | null {
  const env = getEnv();
  const missing = required.filter((key) => !env[key]);
  if (missing.length) return null;
  return {
    accountId: env.R2_ACCOUNT_ID!,
    accessKeyId: env.R2_ACCESS_KEY_ID!,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    bucket: env.R2_BUCKET!,
    publicBaseUrl: env.R2_PUBLIC_BASE_URL!.replace(/\/+$/, ""),
  };
}

export function storageStatus(): StorageStatus {
  const env = getEnv();
  const missing = required.filter((key) => !env[key]);
  return missing.length ? { configured: false, missing } : { configured: true };
}

let client: { key: string; value: S3Client } | null = null;

function s3Client(config: StorageConfig) {
  // Reuse the client across requests in the same process. The key keeps a
  // configuration change (for example a rotated key) from reusing a stale one.
  const key = `${config.accountId}:${config.accessKeyId}:${config.bucket}`;
  if (client?.key === key) return client.value;
  const value = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  client = { key, value };
  return value;
}

/** Detects the image type from its bytes; a client-supplied MIME type is never trusted. */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  const startsWith = (offset: number, signature: number[]) =>
    signature.every((byte, index) => bytes[offset + index] === byte);

  if (bytes.length > 3 && startsWith(0, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", extension: "jpg" };
  if (bytes.length > 8 && startsWith(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: "image/png", extension: "png" };
  }
  if (
    bytes.length > 12 &&
    startsWith(0, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(8, [0x57, 0x45, 0x42, 0x50])
  ) {
    return { mime: "image/webp", extension: "webp" };
  }
  return null;
}

export type UploadResult = { key: string; url: string };

export async function uploadObject(input: {
  folder: "avatars";
  bytes: Uint8Array;
  contentType: string;
  extension: string;
}): Promise<UploadResult> {
  const config = storageConfig();
  if (!config) throw new Error("Object storage is not configured.");

  const now = new Date();
  const key = [
    input.folder,
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    `${randomUUID().replace(/-/g, "")}.${input.extension}`,
  ].join("/");

  await s3Client(config).send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: input.bytes,
      ContentType: input.contentType,
      // Files are content-addressed by a random name, so they never change.
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return { key, url: `${config.publicBaseUrl}/${key}` };
}

/** True when a URL points at this bucket's public base, used to accept stored avatars only. */
export function isOwnPublicUrl(value: string): boolean {
  const config = storageConfig();
  if (!config) return false;
  return value.startsWith(`${config.publicBaseUrl}/`);
}
