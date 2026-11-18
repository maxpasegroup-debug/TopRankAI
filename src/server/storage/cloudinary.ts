import { createHash } from "node:crypto";
import { getEnv } from "../env";

/**
 * Cloudinary image storage.
 *
 * Uploads are signed on the server and proxied through the avatar route, so the
 * API secret never reaches the browser and the request cannot be replayed with
 * different parameters. Signing is plain SHA-1 over the alphabetically sorted
 * parameters plus the secret, so no SDK is needed.
 *
 * Required environment (see .env.example):
 *   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 *
 * The folder is created implicitly by Cloudinary on the first upload.
 */

const REQUIRED = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"] as const;

const FOLDER = "toprank/avatars";

type CloudinaryConfig = { cloudName: string; apiKey: string; apiSecret: string };

export function cloudinaryMissing(): string[] {
  const env = getEnv();
  return REQUIRED.filter((key) => !env[key]);
}

export function cloudinaryConfig(): CloudinaryConfig | null {
  const env = getEnv();
  if (cloudinaryMissing().length) return null;
  return {
    cloudName: env.CLOUDINARY_CLOUD_NAME!,
    apiKey: env.CLOUDINARY_API_KEY!,
    apiSecret: env.CLOUDINARY_API_SECRET!,
  };
}

/** Cloudinary signature: sorted `key=value` pairs joined with `&`, then the secret, SHA-1 hex. */
export function signCloudinaryParams(params: Record<string, string>, apiSecret: string): string {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1").update(payload + apiSecret).digest("hex");
}

export type CloudinaryUpload = { url: string; key: string };

export async function uploadToCloudinary(input: {
  bytes: Uint8Array;
  contentType: string;
  extension: string;
}): Promise<CloudinaryUpload> {
  const config = cloudinaryConfig();
  if (!config) throw new Error("Image uploads are temporarily unavailable.");

  const timestamp = String(Math.floor(Date.now() / 1000));
  // Only `folder` and `timestamp` are sent besides the file, key and signature,
  // so only those two are signed. Cloudinary generates the public ID.
  const params = { folder: FOLDER, timestamp };
  const signature = signCloudinaryParams(params, config.apiSecret);

  const body = new FormData();
  body.append("file", new Blob([new Uint8Array(input.bytes)], { type: input.contentType }), `avatar.${input.extension}`);
  body.append("api_key", config.apiKey);
  body.append("timestamp", timestamp);
  body.append("folder", FOLDER);
  body.append("signature", signature);

  let response: Response;
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw new Error(`Cloudinary request failed: ${error instanceof Error ? error.message : "network error"}`);
  }

  if (!response.ok) {
    // Cloudinary returns { error: { message } } for a rejected upload. Keep the
    // message in the server log only; the browser gets a generic failure.
    const detail = await response.text().catch(() => "");
    throw new Error(`Cloudinary rejected the upload (${response.status}): ${detail.slice(0, 300)}`);
  }

  const payload = (await response.json()) as { secure_url?: string; public_id?: string };
  if (!payload.secure_url) throw new Error("Cloudinary did not return a secure_url.");
  return { url: payload.secure_url, key: payload.public_id ?? "" };
}
