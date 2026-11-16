import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../src/generated/prisma/client";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
try {
  const where: Prisma.UserWhereInput = { role: { in: ["CANDIDATE", "STUDENT"] } };
  const total = await prisma.user.count({ where });
  const candidates = await prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: 0, take: 40,
    select: { id: true, name: true, email: true, phone: true, status: true, createdAt: true,
      accountConsent: { select: { ageBand: true, country: true, acceptedAt: true, revokedAt: true } },
      studentProfile: { select: { targetYear: true, onboardingCompletedAt: true } },
      candidateExamTargets: { where: { active: true }, orderBy: { createdAt: "asc" }, select: { targetYear: true, preparationLevel: true, dailyMinutes: true, exam: { select: { code: true, name: true, category: true, status: true } } } },
      _count: { select: { practiceAttempts: true } },
    } });
  console.log(JSON.stringify({ total, returned: candidates.length }, null, 2));
} catch (e) { const err = e as { name?: string; code?: string; meta?: { code?: string } }; console.log(JSON.stringify({ name: err.name, code: err.code ?? err.meta?.code ?? null })); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
