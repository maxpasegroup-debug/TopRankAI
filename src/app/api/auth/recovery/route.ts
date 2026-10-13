import { apiOk, getRequestId, handleApiError } from "@/server/api/responses";
import { recoverySchema } from "@/server/auth/validation";
import { queuePasswordRecovery } from "@/server/auth/recovery";
import { AuthThrottleError, enforceAuthIdentityRateLimit, enforceAuthRateLimit, readAuthJson, requireAuthOrigin } from "@/server/auth/request-security";

export async function POST(request: Request) {
  const id = getRequestId(request);
  try {
    requireAuthOrigin(request); await enforceAuthRateLimit("login");
    const body = recoverySchema.parse(await readAuthJson(request));
    await enforceAuthIdentityRateLimit("login", request, "recovery:" + body.email);
    return apiOk(await queuePasswordRecovery(body.email), id, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { const response = handleApiError(error, id); if (error instanceof AuthThrottleError) response.headers.set("Retry-After", String(error.retryAfterSeconds)); return response; }
}
