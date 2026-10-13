import { z } from "zod";
import { prisma } from "@/server/db";
import { apiOk, getRequestId, handleApiError } from "@/server/api/responses";
import { ApiError, ValidationApiError } from "@/server/api/errors";
import { ACCOUNT_POLICY_VERSION } from "@/shared/account-policy";
import { hashSessionToken } from "@/server/auth/session";
import { assertAccountPolicyReady } from "@/server/auth/account-consent";
import { AuthThrottleError, enforceAuthRateLimit, enforceAuthIdentityRateLimit, readAuthJson, requireAuthOrigin } from "@/server/auth/request-security";

export async function POST(request: Request) {
  const id = getRequestId(request);
  try {
    requireAuthOrigin(request); await enforceAuthRateLimit("signup");
    const body = z.object({ country: z.enum(["IN", "AE"]), approval: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict().parse(await readAuthJson(request));
    await enforceAuthIdentityRateLimit("signup", request, "guardian:" + hashSessionToken(body.approval));
    assertAccountPolicyReady();
    if (process.env.ACCOUNT_GUARDIAN_VERIFICATION_APPROVED !== "true") throw new ApiError(503, "ACCOUNT_UNAVAILABLE", "Guardian verification is temporarily unavailable");
    const grant = await prisma.guardianRegistrationGrant.findFirst({ where: { tokenHash: hashSessionToken(body.approval), country: body.country,
      policyVersion: ACCOUNT_POLICY_VERSION, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() }, guardian: { role: "PARENT", status: "ACTIVE" } }, select: { id: true } });
    if (!grant) throw new ValidationApiError("Guardian authorization is invalid or unavailable");
    return apiOk({ authorized: true }, id, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { const response = handleApiError(error, id); if (error instanceof AuthThrottleError) response.headers.set("Retry-After", String(error.retryAfterSeconds)); return response; }
}
