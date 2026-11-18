import { getEnv } from "../env";
import { cloudinaryConfig, cloudinaryMissing, uploadToCloudinary } from "./cloudinary";
import { r2Config, r2Missing, uploadToR2 } from "./r2";

/**
 * Storage provider selection.
 *
 * Cloudinary is the default while it is configured; R2 is used when Cloudinary
 * is absent, so an existing R2 bucket keeps working after a provider change.
 * Set `STORAGE_PROVIDER=cloudinary|r2` to pin one explicitly (for example in
 * production once the R2 bucket exists).
 */

export type StorageProvider = "cloudinary" | "r2";

export type StorageStatus =
  | { configured: true; provider: StorageProvider }
  | { configured: false; provider: null; missing: string[] };

/** The provider that would handle an upload right now, or null when none is configured. */
export function activeProvider(): StorageProvider | null {
  const explicit = getEnv().STORAGE_PROVIDER;
  if (explicit === "cloudinary") return cloudinaryConfig() ? "cloudinary" : null;
  if (explicit === "r2") return r2Config() ? "r2" : null;
  if (cloudinaryConfig()) return "cloudinary";
  if (r2Config()) return "r2";
  return null;
}

export function storageStatus(): StorageStatus {
  const provider = activeProvider();
  if (provider) return { configured: true, provider };
  // Report the variables the operator most likely meant to fill in: the pinned
  // provider, otherwise Cloudinary (the default).
  const missing = getEnv().STORAGE_PROVIDER === "r2" ? r2Missing() : cloudinaryMissing();
  return { configured: false, provider: null, missing };
}

export type AvatarUpload = { url: string; key: string; provider: StorageProvider };

export async function uploadAvatar(input: {
  bytes: Uint8Array;
  contentType: string;
  extension: string;
}): Promise<AvatarUpload> {
  const provider = activeProvider();
  if (!provider) throw new Error("Image uploads are temporarily unavailable.");

  if (provider === "cloudinary") {
    const uploaded = await uploadToCloudinary(input);
    return { ...uploaded, provider };
  }

  const uploaded = await uploadToR2({ folder: "avatars", ...input });
  return { ...uploaded, provider };
}
