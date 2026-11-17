import { NextResponse } from "next/server";
import { AVATAR_MAX_BYTES, detectImageType, storageStatus, uploadObject } from "@/server/storage/r2";

export const runtime = "nodejs";

/**
 * Avatar upload endpoint.
 *
 * Registration happens before an account exists, so this endpoint cannot
 * require a session. It stays safe by accepting only real JPEG/PNG/WebP bytes
 * under 2 MB, storing them under a random name, and throttling each client.
 *
 * The in-memory throttle is per process: it stops accidental floods in a single
 * instance but is not a substitute for a shared limiter behind multiple
 * instances. The object key is random and unguessable, and files are public
 * reads only - there is no listing or overwrite surface.
 */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_UPLOADS_PER_WINDOW = 10;
const attempts = new Map<string, number[]>();

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}

function consume(key: string) {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_UPLOADS_PER_WINDOW) {
    attempts.set(key, recent);
    return { allowed: false as const, retryAfterSeconds: Math.ceil((WINDOW_MS - (now - recent[0])) / 1000) };
  }
  recent.push(now);
  attempts.set(key, recent);
  // Keep the map from growing across many one-off clients.
  if (attempts.size > 5_000) {
    for (const [entry, times] of attempts) {
      if (times.every((time) => now - time >= WINDOW_MS)) attempts.delete(entry);
    }
  }
  return { allowed: true as const };
}

export async function GET() {
  const status = storageStatus();
  return NextResponse.json({
    configured: status.configured,
    maxBytes: AVATAR_MAX_BYTES,
    missing: status.configured ? [] : status.missing,
  });
}

export async function POST(request: Request) {
  if (!storageStatus().configured) {
    return NextResponse.json(
      { error: "File storage is not configured yet.", code: "STORAGE_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const limit = consume(clientKey(request));
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many uploads. Try again shortly.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart form upload.", code: "BAD_REQUEST" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose an image to upload.", code: "BAD_REQUEST" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "That file is empty.", code: "BAD_REQUEST" }, { status: 400 });
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return NextResponse.json(
      { error: `Images must be ${Math.round(AVATAR_MAX_BYTES / (1024 * 1024))} MB or smaller.`, code: "TOO_LARGE" },
      { status: 413 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const image = detectImageType(bytes);
  if (!image) {
    return NextResponse.json(
      { error: "Only JPEG, PNG or WebP images are accepted.", code: "INVALID_TYPE" },
      { status: 415 },
    );
  }

  try {
    const uploaded = await uploadObject({
      folder: "avatars",
      bytes,
      contentType: image.mime,
      extension: image.extension,
    });
    return NextResponse.json({ url: uploaded.url, key: uploaded.key }, { status: 201 });
  } catch (error) {
    console.error("avatar upload failed", error);
    return NextResponse.json(
      { error: "The image could not be stored. Please try again.", code: "UPLOAD_FAILED" },
      { status: 502 },
    );
  }
}
