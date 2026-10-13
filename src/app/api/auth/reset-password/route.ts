import { apiOk, getRequestId, handleApiError } from "@/server/api/responses";
import { resetPasswordSchema } from "@/server/auth/validation";
import { resetPassword } from "@/server/auth/recovery";
import { hashSessionToken, sessionCookieOptions, SESSION_COOKIE } from "@/server/auth/session";
import { AuthThrottleError, enforceAuthIdentityRateLimit, enforceAuthRateLimit, readAuthJson, requireAuthOrigin } from "@/server/auth/request-security";

export async function POST(request: Request) {
  const id = getRequestId(request);
  try {
    requireAuthOrigin(request); await enforceAuthRateLimit("login");
    const body = resetPasswordSchema.parse(await readAuthJson(request));
    await enforceAuthIdentityRateLimit("login", request, "reset:" + hashSessionToken(body.token));
    const response = apiOk(await resetPassword(body.token, body.password), id, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(new Date(0)), maxAge: 0 });
    return response;
  } catch (error) { const response = handleApiError(error, id); if (error instanceof AuthThrottleError) response.headers.set("Retry-After", String(error.retryAfterSeconds)); return response; }
}
