import { getCurrentUser, SESSION_COOKIE, sessionCookieOptions } from "@/server/auth/session";
import { AuthenticationApiError, AuthorizationApiError } from "@/server/api/errors";
import { apiOk, getRequestId, handleApiError } from "@/server/api/responses";
import { readAuthJson, requireAuthOrigin } from "@/server/auth/request-security";
import { accountConsentSchema } from "@/server/auth/validation";
import { acceptAccountConsent, withdrawAccountConsent } from "@/server/auth/account-consent";
import { prisma } from "@/server/db";

export async function GET(request: Request) {
  const id = getRequestId(request);
  try {
    const user = await getCurrentUser(true); if (!user) throw new AuthenticationApiError();
    if (!["STUDENT", "PARENT"].includes(user.role)) throw new AuthorizationApiError();
    const receipt = await prisma.accountConsent.findUnique({ where: { userId: user.id }, select: { country: true, ageBand: true, termsVersion: true, privacyVersion: true, acceptedAt: true, revokedAt: true } });
    return apiOk(receipt ? { ...receipt, current: !user.requiresLegalConsent } : null, id, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return handleApiError(error, id); }
}
export async function POST(request: Request) {
  const id = getRequestId(request);
  try { requireAuthOrigin(request); const user = await getCurrentUser(true); if (!user) throw new AuthenticationApiError();
    return apiOk(await acceptAccountConsent(user, accountConsentSchema.parse(await readAuthJson(request))), id, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return handleApiError(error, id); }
}
export async function DELETE(request: Request) {
  const id = getRequestId(request);
  try { requireAuthOrigin(request); const user = await getCurrentUser(true); if (!user) throw new AuthenticationApiError();
    const response = apiOk(await withdrawAccountConsent(user), id, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(new Date(0)), maxAge: 0 });
    return response;
  } catch (error) { return handleApiError(error, id); }
}
