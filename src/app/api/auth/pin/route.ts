import { apiOk, getRequestId, handleApiError } from "@/server/api/responses";
import { AuthThrottleError, enforceAuthIdentityRateLimit, enforceAuthRateLimit, readAuthJson, requireAuthOrigin } from "@/server/auth/request-security";
import { pinRequestSchema } from "@/server/auth/pin-validation";
import { assertPinReady, finishPinReset, finishPinSignup, loginWithPin, requestPinOtp, verifyPinOtp } from "@/server/auth/pin-auth";
import { hashSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/server/auth/session";

export async function POST(request: Request) {
  const id = getRequestId(request);
  try {
    requireAuthOrigin(request); assertPinReady();
    await enforceAuthRateLimit("login");
    const body = pinRequestSchema.parse(await readAuthJson(request));
    const action = body.action === "requestSignup" || body.action === "signup" ? "signup" : "login";
    const identity = body.action === "requestSignup" ? body.registration.email : body.action === "requestReset" ? body.email
      : body.action === "login" ? "pin:" + body.phone : "otp:" + hashSessionToken(body.challenge);
    await enforceAuthIdentityRateLimit(action, request, identity);
    let data;
    switch (body.action) {
      case "requestSignup": data = await requestPinOtp(body.registration.email, body.registration); break;
      case "requestReset": data = await requestPinOtp(body.email); break;
      case "verify": data = await verifyPinOtp(body.challenge, body.code); break;
      case "signup": data = await finishPinSignup(body); break;
      case "reset": data = await finishPinReset(body); break;
      case "login": data = await loginWithPin(body.phone, body.pin); break;
    }
    const response = apiOk("session" in data ? { user: data.user } : data, id, { headers: { "Cache-Control": "no-store" } });
    if ("session" in data) response.cookies.set(SESSION_COOKIE, data.session.token, sessionCookieOptions(data.session.expiresAt));
    if (body.action === "reset") response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(new Date(0)), maxAge: 0 });
    return response;
  } catch (error) {
    const response = handleApiError(error, id); response.headers.set("Cache-Control", "no-store");
    if (error instanceof AuthThrottleError) response.headers.set("Retry-After", String(error.retryAfterSeconds));
    return response;
  }
}
