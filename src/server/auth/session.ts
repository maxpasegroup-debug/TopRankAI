import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { UserRole } from "@/generated/prisma/enums";
import { prisma } from "../db";
import { canAccessRole, type Role } from "./roles";

export const SESSION_COOKIE = "toprank_session";
export const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 14;

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  requiresLegalConsent?: boolean;
};

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, db: Pick<typeof prisma, "session"> = prisma) {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.session.create({
    data: {
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function revokeSession(token: string) {
  await prisma.session.updateMany({
    where: {
      tokenHash: hashSessionToken(token),
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

export async function getCurrentUser(allowConsentOnly = false): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.session.findFirst({
    where: {
      tokenHash: hashSessionToken(token),
      revokedAt: null,
      expiresAt: { gt: new Date() },
      user: { status: "ACTIVE" },
    },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  const consentRequired = ["STUDENT", "PARENT"].includes(session.user.role);
  const receipt = consentRequired ? await prisma.accountConsent.findUnique({
      where: { userId: session.user.id }, include: { guardianGrant: { include: { guardian: { select: { status: true, role: true, accountConsent: { select: { ageBand: true, termsVersion: true, privacyVersion: true, revokedAt: true } } } } } } },
    }) : null;
  const requiresLegalConsent = consentRequired && (!(await import("./account-consent")).isConsentCurrent(receipt) || (session.user.role === "PARENT" && receipt?.ageBand !== "18_PLUS"));
  if (requiresLegalConsent && !allowConsentOnly) return null;

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    requiresLegalConsent,
  };
}

export async function requireAuth() {
  const user = await getCurrentUser(true);

  if (!user) {
    redirect("/login");
  }
  if (user.requiresLegalConsent) redirect("/account/consent");

  return user;
}

export async function requireRole(roles: readonly (UserRole | Role)[]) {
  const user = await requireAuth();

  if (!canAccessRole(user.role, roles)) {
    redirect("/unauthorized");
  }

  return user;
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}
