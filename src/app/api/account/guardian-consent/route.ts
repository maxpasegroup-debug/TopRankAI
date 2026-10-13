import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { AuthenticationApiError, AuthorizationApiError } from "@/server/api/errors";
import { apiOk, getRequestId, handleApiError } from "@/server/api/responses";
import { readAuthJson, requireAuthOrigin } from "@/server/auth/request-security";
import { revokeGuardianApproval } from "@/server/auth/account-consent";
import { prisma } from "@/server/db";

export async function GET(request: Request) {
  const id = getRequestId(request);
  try {
    const user = await getCurrentUser(); if (!user) throw new AuthenticationApiError();
    if (user.role !== "PARENT") throw new AuthorizationApiError();
    return apiOk(await prisma.guardianRegistrationGrant.findMany({ where: { guardianId: user.id }, take: 100, orderBy: { verifiedAt: "desc" },
      select: { id: true, country: true, verifiedAt: true, usedAt: true, revokedAt: true, expiresAt: true } }), id, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return handleApiError(error, id); }
}
export async function POST(request: Request) {
  const id = getRequestId(request);
  try { requireAuthOrigin(request); const user = await getCurrentUser(); if (!user) throw new AuthenticationApiError();
    const body = z.object({ grantId: z.string().min(1).max(100) }).strict().parse(await readAuthJson(request));
    return apiOk(await revokeGuardianApproval(user, body.grantId), id, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return handleApiError(error, id); }
}
