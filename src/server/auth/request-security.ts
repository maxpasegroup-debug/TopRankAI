import { ApiError, AuthorizationApiError, ValidationApiError } from "@/server/api/errors";
import { authRateLimiter, type AuthAction, type AuthRateLimitIdentity } from "./rate-limit";
import { trustedClient } from "./rate-limit-identity";
import { readBoundedJson } from "@/server/api/json-body";

export const AUTH_BODY_LIMIT_BYTES = 4096;
export const AUTH_LIMITER_TIMEOUT_MS = 2000;

function unavailable() {
  return new ApiError(503, "AUTH_UNAVAILABLE", "Authentication is temporarily unavailable");
}

export function requireAuthOrigin(request: Request) {
  let target: URL;
  try {
    // Production must use an operator-configured canonical URL, never proxy headers.
    if (process.env.NODE_ENV === "production" && !process.env.APP_URL) throw unavailable();
    target = new URL(process.env.APP_URL || request.url);
    if (!["http:", "https:"].includes(target.protocol) || target.username || target.password) throw unavailable();
    if (process.env.NODE_ENV === "production" && target.protocol !== "https:") throw unavailable();
  } catch {
    throw unavailable();
  }

  const origin = request.headers.get("origin");
  const source = origin ?? request.headers.get("referer");
  try {
    if (!source || request.headers.get("sec-fetch-site") === "cross-site") throw new Error();
    const parsed = new URL(source);
    if (parsed.username || parsed.password || parsed.origin !== target.origin) throw new Error();
    // Origin is an origin only; Referer may include a path/query.
    if (origin !== null && source !== parsed.origin) throw new Error();
  } catch {
    throw new AuthorizationApiError("Request origin is not allowed");
  }
  return target.origin;
}

export async function enforceAuthRateLimit(action: AuthAction, identity?: AuthRateLimitIdentity) {
  if (!authRateLimiter) {
    if (process.env.AUTH_RATE_LIMIT_ACTIVATED !== "true" &&
        (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test")) return;
    throw unavailable();
  }

  let decision;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    decision = await Promise.race([
      identity ? authRateLimiter.consume(action, identity) : authRateLimiter.consume(action),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(unavailable()), AUTH_LIMITER_TIMEOUT_MS);
      }),
    ]);
    if (typeof decision?.allowed !== "boolean") throw unavailable();
    if (!decision.allowed && (!Number.isFinite(decision.retryAfterSeconds) || decision.retryAfterSeconds <= 0)) {
      throw unavailable();
    }
  } catch {
    throw unavailable();
  } finally {
    clearTimeout(timeout);
  }
  if (!decision.allowed) {
    throw new AuthThrottleError(Math.min(86400, Math.ceil(decision.retryAfterSeconds)));
  }
}

export async function enforceAuthIdentityRateLimit(action: AuthAction, request: Request, account: string) {
  if (!authRateLimiter) return enforceAuthRateLimit(action);
  let client: string;
  try { client = trustedClient(request); } catch { throw unavailable(); }
  await enforceAuthRateLimit(action, { client, account });
}

export class AuthThrottleError extends ApiError {
  constructor(public readonly retryAfterSeconds: number) {
    super(429, "RATE_LIMITED", "Too many requests. Please try again later");
  }
}

export async function readAuthJson(request: Request, limitBytes = AUTH_BODY_LIMIT_BYTES): Promise<unknown> {
  if (!Number.isInteger(limitBytes) || limitBytes < 1 || limitBytes > 32768) throw new ValidationApiError();
  return readBoundedJson(request, limitBytes);
}
