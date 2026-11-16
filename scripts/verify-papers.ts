import "dotenv/config";
import { prisma } from "../src/server/db";
import { ensureDailyExam, readPaperMeta } from "../src/server/platform/daily-exam";
import { getCandidateExams } from "../src/server/platform/candidate";
import { todayDate } from "../src/server/platform/utils";

/**
 * Builds one paper per exam for a throwaway candidate and prints the mode,
 * question count, marks, duration, section coverage and duplicate-stem count.
 * Nothing is left behind: the candidate and its papers are deleted at the end.
 *
 * Usage: npx tsx scripts/verify-papers.ts [EXAM_CODE ...]
 */

const requested = process.argv.slice(2).map((code) => code.toUpperCase());
const exams = await prisma.exam.findMany({
  where: { active: true, ...(requested.length ? { code: { in: requested } } : {}) },
  orderBy: { code: "asc" },
  select: { id: true, code: true, configuration: { select: { sections: true } } },
});

const user = await prisma.user.create({
  data: {
    email: `paper-verifier-${Date.now()}@toprank.local`,
    passwordHash: "not-a-login-account",
    name: "Paper verifier",
    role: "CANDIDATE",
    status: "ACTIVE",
    onboardingCompletedAt: new Date(),
  },
  select: { id: true },
});

const year = new Date().getFullYear() + 1;
for (const exam of exams) {
  await prisma.candidateExamTarget.create({
    data: { userId: user.id, examId: exam.id, targetYear: year, active: true },
  });
}

const candidates = await getCandidateExams(user.id);
const rows: string[] = [];
for (const exam of exams) {
  const candidate = candidates.find((entry) => entry.examId === exam.id);
  if (!candidate) {
    rows.push(`${exam.code.padEnd(15)} target not resolved`);
    continue;
  }
  const daily = await ensureDailyExam(user.id, candidate);
  const meta = readPaperMeta(daily.configSnapshot);
  const links = await prisma.questionExam.findMany({
    where: { examId: exam.id, questionId: { in: daily.questionIds } },
    select: { question: { select: { text: true, subject: { select: { code: true } } } } },
  });
  const bySubject: Record<string, number> = {};
  const texts = new Map<string, number>();
  for (const link of links) {
    bySubject[link.question.subject.code] = (bySubject[link.question.subject.code] ?? 0) + 1;
    const key = link.question.text.toLowerCase().replace(/\s+/g, " ").replace(/[^\p{L}\p{N} ]+/gu, "");
    texts.set(key, (texts.get(key) ?? 0) + 1);
  }
  const duplicates = [...texts.values()].filter((count) => count > 1).length;
  const coverage = (meta?.sectionCoverage ?? [])
    .map((section) => `${section.name}:${section.selected}/${section.required}`)
    .join(" | ");
  rows.push(
    `${exam.code.padEnd(15)} ${String(meta?.mode).padEnd(13)} ${String(daily.questionIds.length).padStart(3)} Q · ${meta?.officialTotal ?? "?"} official · ${meta?.officialMarks ?? "?"} marks · ${daily.durationMinutes} min · dup ${duplicates} · ${JSON.stringify(bySubject)}\n                ${coverage}`,
  );
}

console.log(rows.join("\n"));

await prisma.dailyGoal.deleteMany({ where: { userId: user.id } });
await prisma.dailyExam.deleteMany({ where: { userId: user.id } });
await prisma.candidateExamTarget.deleteMany({ where: { userId: user.id } });
await prisma.user.delete({ where: { id: user.id } });
await prisma.$disconnect();
