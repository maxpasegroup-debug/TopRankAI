import { AuthenticationApiError } from "@/server/api/errors";
import { apiOk, getRequestId, handleApiError } from "@/server/api/responses";
import { createSession, sessionCookieOptions, SESSION_COOKIE } from "@/server/auth/session";
import { loginSchema } from "@/server/auth/validation";
import { verifyPassword } from "@/server/auth/password";
import { prisma } from "@/server/db";
import { logger } from "@/server/logger";
import { AuthThrottleError, enforceAuthIdentityRateLimit, enforceAuthRateLimit, readAuthJson, requireAuthOrigin } from "@/server/auth/request-security";

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    requireAuthOrigin(request);
    await enforceAuthRateLimit("login");
    const body = loginSchema.parse(await readAuthJson(request));
    await enforceAuthIdentityRateLimit("login", request, body.email);
    const user = await prisma.user.findUnique({ where: { email: body.email } });

    if (!user || user.status !== "ACTIVE" || user.pinHash) {
      throw new AuthenticationApiError("Invalid email or password");
    }

    const passwordMatches = await verifyPassword(body.password, user.passwordHash);

    if (!passwordMatches) {
      throw new AuthenticationApiError("Invalid email or password");
    }

    const session = await createSession(user.id);
    const response = apiOk({ user: { id: user.id, email: user.email, name: user.name, role: user.role } }, requestId);

    response.cookies.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt));
    logger.info({ requestId, userId: user.id, role: user.role }, "User logged in");

    return response;
  } catch (error) {
    const response = handleApiError(error, requestId);
    if (error instanceof AuthThrottleError) response.headers.set("Retry-After", String(error.retryAfterSeconds));
    return response;
  }
}
