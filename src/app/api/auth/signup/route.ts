import { ConflictApiError } from "@/server/api/errors";
import { apiOk, getRequestId, handleApiError } from "@/server/api/responses";
import { createSession, sessionCookieOptions, SESSION_COOKIE } from "@/server/auth/session";
import { signupSchema } from "@/server/auth/validation";
import { hashPassword } from "@/server/auth/password";
import { prisma } from "@/server/db";
import { logger } from "@/server/logger";
import { assertAccountPolicyReady, prepareAccountConsent } from "@/server/auth/account-consent";
import { AuthThrottleError, enforceAuthIdentityRateLimit, enforceAuthRateLimit, readAuthJson, requireAuthOrigin } from "@/server/auth/request-security";

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    requireAuthOrigin(request);
    await enforceAuthRateLimit("signup");
    const body = signupSchema.parse(await readAuthJson(request));
    await enforceAuthIdentityRateLimit("signup", request, body.email);
    assertAccountPolicyReady();
    const existingUser = await prisma.user.findUnique({ where: { email: body.email } });

    if (existingUser) {
      throw new ConflictApiError("An account with this email already exists");
    }

    const passwordHash = await hashPassword(body.password);

    const user = await prisma.$transaction(async (tx) => {
      const saveConsent = await prepareAccountConsent(tx, body.email, body);
      const createdUser = await tx.user.create({
        data: {
          email: body.email,
          name: body.name,
          passwordHash,
          role: "STUDENT",
        },
      });

      await tx.studentProfile.create({ data: { userId: createdUser.id } });
      await saveConsent(createdUser.id);
      const session = await createSession(createdUser.id, tx);
      return { ...createdUser, session };
    });

    const session = user.session;
    const response = apiOk({ user: { id: user.id, email: user.email, name: user.name, role: user.role } }, requestId, {
      status: 201,
    });

    response.cookies.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt));
    logger.info({ requestId, userId: user.id, role: user.role }, "User signed up");

    return response;
  } catch (error) {
    const response = handleApiError(error, requestId);
    if (error instanceof AuthThrottleError) response.headers.set("Retry-After", String(error.retryAfterSeconds));
    return response;
  }
}
