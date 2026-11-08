import { ApiError } from "@/server/api/errors";
import { getRequestId, handleApiError } from "@/server/api/responses";
import { signupSchema } from "@/server/auth/validation";
import { AuthThrottleError, enforceAuthIdentityRateLimit, enforceAuthRateLimit, readAuthJson, requireAuthOrigin } from "@/server/auth/request-security";

// Retired: public registration must go through the email-verified PIN workflow.
export async function POST(request: Request) {
  const id = getRequestId(request);
  try {
    requireAuthOrigin(request); await enforceAuthRateLimit("signup");
    const body = signupSchema.parse(await readAuthJson(request));
    await enforceAuthIdentityRateLimit("signup", request, body.email);
    throw new ApiError(410, "SIGNUP_UPDATED", "Continue with SIA signup to verify your email and create a PIN.");
  } catch (error) {
    const response = handleApiError(error, id); response.headers.set("Cache-Control", "no-store");
    if (error instanceof AuthThrottleError) response.headers.set("Retry-After", String(error.retryAfterSeconds));
    return response;
  }
}
