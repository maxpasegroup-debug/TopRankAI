import { Prisma } from "@/generated/prisma/client";
import type { AuthUser } from "@/server/auth/session";
import { prisma } from "@/server/db";

function maskEmail(email: string) { const [name, domain] = email.split("@"); return `${name.slice(0, 1)}${"•".repeat(Math.min(Math.max(name.length - 1, 2), 5))}@${domain ?? ""}`; }
function maskPhone(phone: string | null) { return phone ? `••••••${phone.slice(-4)}` : null; }

export async function candidateMonitor(_admin: AuthUser, options: { page: number; query: string }) {
  const pageSize = 40, skip = (options.page - 1) * pageSize, query = options.query.trim();
  const where: Prisma.UserWhereInput = { role: { in: ["CANDIDATE", "STUDENT"] }, ...(query ? { OR: [
    { name: { contains: query, mode: "insensitive" as const } },
    { email: { contains: query, mode: "insensitive" as const } },
  ] } : {}) };
  const [total, candidates] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: pageSize,
      select: { id: true, name: true, email: true, phone: true, status: true, createdAt: true,
        accountConsent: { select: { ageBand: true, country: true, acceptedAt: true, revokedAt: true } },
        studentProfile: { select: { targetYear: true, onboardingCompletedAt: true } },
        candidateExamTargets: { where: { active: true }, orderBy: { createdAt: "asc" }, select: { targetYear: true, preparationLevel: true, dailyMinutes: true, exam: { select: { code: true, name: true, category: true, status: true } } } },
        _count: { select: { practiceAttempts: true } },
      } }),
  ]);
  return { total, page: options.page, pageSize, candidates: candidates.map((candidate) => ({
    id: candidate.id, name: candidate.name, email: maskEmail(candidate.email), phone: maskPhone(candidate.phone), status: candidate.status,
    joinedAt: candidate.createdAt, ageBand: candidate.accountConsent?.ageBand ?? "NOT RECORDED", country: candidate.accountConsent?.country ?? "—",
    consentCurrent: Boolean(candidate.accountConsent && !candidate.accountConsent.revokedAt), onboarded: Boolean(candidate.studentProfile?.onboardingCompletedAt),
    attempts: candidate._count.practiceAttempts, targets: candidate.candidateExamTargets.map((target) => ({ code: target.exam.code, name: target.exam.name,
      category: target.exam.category, status: target.exam.status, targetYear: target.targetYear, preparationLevel: target.preparationLevel, dailyMinutes: target.dailyMinutes })),
  })) };
}
