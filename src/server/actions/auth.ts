"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, revokeSession, sessionCookieOptions, SESSION_COOKIE } from "@/server/auth/session";
import { ACCOUNT_POLICY_VERSION } from "@/shared/account-policy";
import { ageFromDate } from "@/server/platform/utils";
import { readExamPattern } from "@/server/platform/patterns";
import { registrationSchema } from "@/server/platform/validation";

export type AuthActionResult = { ok: true; redirectTo: string } | { ok: false; message: string; field?: string };
export type AdminPasswordResult = { ok: true; message: string } | { ok: false; message: string };

export async function registerCandidate(raw: unknown): Promise<AuthActionResult> {
  const parsed = registrationSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: issue?.message ?? "Please check the registration details.", field: issue?.path.join(".") };
  }
  const input = parsed.data;
  const dateOfBirth = new Date(`${input.dateOfBirth}T00:00:00.000Z`);
  if (Number.isNaN(dateOfBirth.getTime())) return { ok: false, message: "Enter a valid date of birth." };
  const age = ageFromDate(dateOfBirth);
  if (age < 18) {
    return {
      ok: false,
      message: "Self-registration is currently available for candidates aged 18 and above. Accounts for younger candidates need verified guardian consent, which is not enabled in this build.",
      field: "dateOfBirth",
    };
  }
  if (age > 100) return { ok: false, message: "Enter a valid date of birth.", field: "dateOfBirth" };

  const [exams, existing] = await Promise.all([
    prisma.exam.findMany({
      where: { id: { in: input.exams.map((exam) => exam.examId) }, active: true, status: "PUBLISHED" },
      select: { id: true, code: true, name: true, configuration: { select: { sections: true } } },
    }),
    prisma.user.findUnique({ where: { email: input.email }, select: { id: true } }),
  ]);
  if (exams.length !== input.exams.length) {
    return { ok: false, message: "One or more selected exams are no longer available. Refresh and choose again." };
  }
  const examById = new Map(exams.map((exam) => [exam.id, exam]));

  const partByExam = new Map<string, string | null>();
  for (const selection of input.exams) {
    const exam = examById.get(selection.examId);
    if (!exam) return { ok: false, message: "One or more selected exams are unavailable." };
    const pattern = readExamPattern(exam.configuration?.sections);
    const part = selection.partCode
      ? pattern?.parts.find((item) => item.code === selection.partCode) ?? null
      : pattern?.parts[0] ?? null;
    if (selection.partCode && !part) {
      return { ok: false, message: `Choose a valid paper for ${exam.name}.` };
    }
    partByExam.set(selection.examId, part?.code ?? null);
  }

  if (existing) return { ok: false, message: "An account with this email already exists. Try signing in instead.", field: "email" };

  const passwordHash = await hashPassword(input.password);
  const dailyMinutes = Math.max(...input.exams.map((exam) => exam.dailyMinutes));
  const first = input.exams[0];
  const firstExam = examById.get(first.examId);

  let session: Awaited<ReturnType<typeof createSession>>;
  try {
    session = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          pinHash: null,
          name: input.name,
          role: "CANDIDATE",
          status: "ACTIVE",
          dateOfBirth,
          gender: input.gender,
          state: input.state,
          city: input.city,
          education: input.education,
          currentEducationLevel: input.education,
          preferredLanguage: input.preferredLanguage === "English" ? "en" : input.preferredLanguage,
          avatarUrl: input.avatarUrl || null,
          phone: input.phone || null,
          dailyStudyMinutes: dailyMinutes,
          timezone: "Asia/Kolkata",
          onboardingCompletedAt: new Date(),
          lastActiveAt: new Date(),
        },
        select: { id: true },
      });
      await tx.accountConsent.create({
        data: {
          userId: user.id,
          country: "IN",
          ageBand: "18_PLUS",
          termsVersion: ACCOUNT_POLICY_VERSION,
          privacyVersion: ACCOUNT_POLICY_VERSION,
        },
      });
      await tx.studentProfile.create({
        data: {
          userId: user.id,
          targetExamId: first.examId,
          targetYear: first.targetYear,
          dailyStudyMins: dailyMinutes,
          onboardingCompletedAt: new Date(),
        },
      });
      await tx.candidateExamTarget.createMany({
        data: input.exams.map((exam) => ({
          userId: user.id,
          examId: exam.examId,
          targetYear: exam.targetYear,
          preparationLevel: exam.level,
          dailyMinutes: exam.dailyMinutes,
          examPart: partByExam.get(exam.examId) ?? null,
          active: true,
        })),
      });
      await tx.subscription.create({
        data: { userId: user.id, plan: "FREE", status: "ACTIVE", startsAt: new Date(), features: { dailyExams: true, learningCentre: true, analytics: true, aiTutor: "limited" } },
      });
      await tx.auditEvent.create({
        data: { actorId: user.id, action: "ACCOUNT_REGISTERED", entity: "User", entityId: user.id, detail: JSON.stringify({ exams: input.exams.map((exam) => exam.examId) }) },
      });
      await tx.notification.createMany({
        data: [
          { userId: user.id, type: "TARGET", title: "Your preparation plan is ready", body: `${input.exams.length} exam${input.exams.length === 1 ? "" : "s"} added. Your first daily exam will be prepared for ${firstExam?.name ?? "your target exam"}.`, href: "/app" },
          { userId: user.id, type: "SYSTEM", title: "Welcome to TopRank", body: "Start with today's daily exam, then review every explanation. Your readiness score grows from real activity only.", href: "/app" },
        ],
      });
      return createSession(user.id, tx);
    }, { timeout: 20_000 });
  } catch (error) {
    return { ok: false, message: "We could not create the account. The email or phone number may already be in use." };
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt));
  return { ok: true, redirectTo: "/app" };
}

export async function loginUser(raw: { email: string; password: string }): Promise<AuthActionResult> {
  const email = String(raw.email ?? "").trim().toLowerCase();
  const password = String(raw.password ?? "");
  if (!email || !password) return { ok: false, message: "Enter your email and password." };
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== "ACTIVE" || user.pinHash) return { ok: false, message: "Invalid email or password." };
  if (user.role === "PLATFORM_ADMIN") return { ok: false, message: "Administrators must sign in at /login/admin." };
  if (!(await verifyPassword(password, user.passwordHash))) return { ok: false, message: "Invalid email or password." };

  const [session] = await Promise.all([
    createSession(user.id),
    prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } }),
  ]);
  const store = await cookies();
  store.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt));
  return { ok: true, redirectTo: "/app" };
}

export async function logoutUser() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await revokeSession(token);
  // Delete the cookie and also expire it so a stale browser copy cannot be sent.
  store.delete(SESSION_COOKIE);
  store.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  // Public pages are cached as server components; clear the layout cache so the
  // header immediately renders as signed-out after an administrator signs out.
  revalidatePath("/", "layout");
  redirect("/");
}

export async function loginAdmin(raw: { email: string; password: string }): Promise<AuthActionResult> {
  const email = String(raw.email ?? "").trim().toLowerCase();
  const password = String(raw.password ?? "");
  if (!email || !password) return { ok: false, message: "Enter your administrator email and password." };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.role !== "PLATFORM_ADMIN" || user.status !== "ACTIVE" || user.pinHash) {
    return { ok: false, message: "Invalid administrator credentials." };
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    return { ok: false, message: "Invalid administrator credentials." };
  }

  const session = await createSession(user.id);
  const store = await cookies();
  store.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt));
  await prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } });
  return { ok: true, redirectTo: "/admin" };
}

export async function resetAdminPassword(raw: {
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<AdminPasswordResult> {
  const email = String(raw.email ?? "").trim().toLowerCase();
  const currentPassword = String(raw.currentPassword ?? "");
  const newPassword = String(raw.newPassword ?? "");
  const confirmPassword = String(raw.confirmPassword ?? "");

  if (!email || !currentPassword) return { ok: false, message: "Enter your administrator email and current password." };
  if (newPassword.length < 8) return { ok: false, message: "Use at least 8 characters for the new password." };
  if (newPassword.length > 72) return { ok: false, message: "The new password is too long." };
  if (newPassword !== confirmPassword) return { ok: false, message: "The new passwords do not match." };
  if (newPassword === currentPassword) return { ok: false, message: "Choose a password different from the current one." };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.role !== "PLATFORM_ADMIN" || user.status !== "ACTIVE") {
    return { ok: false, message: "Administrator account not found." };
  }
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    return { ok: false, message: "The current password is incorrect." };
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
    prisma.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  return { ok: true, message: "Administrator password updated. Sign in with the new password." };
}
