import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getEnv } from "../env";

/**
 * Cloudflare R2 storage, kept for production. Cloudinary is the active
 * provider while R2 has no billing method on the account; the upload route
 * picks whichever provider is configured (see `src/server/storage/index.ts`).
 *
 * R2 speaks the S3 API, so the AWS SDK is pointed at the account's R2 endpoint.
 * Uploads are proxied through the route handler: the browser never sees the
 * credentials, the bucket needs no CORS rule, and the file type and size are
 * checked before anything is written.
 *
 * Required environment (see .env.example):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET,
 *   R2_PUBLIC_BASE_URL
 *
 * `R2_PUBLIC_BASE_URL` is what the browser uses to read a file: either the
 * bucket's r2.dev development URL or a custom domain connected to the bucket.
 */

const REQUIRED = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_BASE_URL",
] as const;

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
};

export function r2Missing(): string[] {
  const env = getEnv();
  return REQUIRED.filter((key) => !env[key]);
}

export function r2Config(): R2Config | null {
  const env = getEnv();
  if (r2Missing().length) return null;
  return {
    accountId: env.R2_ACCOUNT_ID!,
    accessKeyId: env.R2_ACCESS_KEY_ID!,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    bucket: env.R2_BUCKET!,
    publicBaseUrl: env.R2_PUBLIC_BASE_URL!.replace(/\/+$/, ""),
  };
}

let client: { key: string; value: S3Client } | null = null;

function s3Client(config: R2Config) {
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

export type R2Upload = { key: string; url: string };

export async function uploadToR2(input: {
  folder: "avatars";
  bytes: Uint8Array;
  contentType: string;
  extension: string;
}): Promise<R2Upload> {
  const config = r2Config();
  if (!config) throw new Error("R2 is not configured.");

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
