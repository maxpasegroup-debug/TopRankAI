/**
 * Shared image rules for every storage provider.
 *
 * The file type is decided from the bytes, never from the browser-supplied
 * MIME type or file name, so a renamed executable cannot be stored as a JPEG.
 */

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export type ImageType = { mime: "image/jpeg" | "image/png" | "image/webp"; extension: "jpg" | "png" | "webp" };

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
