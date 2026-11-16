import "dotenv/config";
import { prisma } from "../src/server/db";

/**
 * Question rows can be created twice with identical text (one from the curated
 * seed, one from an authoring run, or two authoring runs). The paper engine now
 * de-duplicates on content, but the bank itself should also stay clean so
 * counts and coverage are honest.
 *
 * This script keeps one live row per normalised stem (the oldest row that is
 * already published and reviewed, otherwise the oldest row) and archives the
 * rest. Rows are archived rather than deleted because past attempts store
 * question IDs and must remain reviewable.
 *
 * Usage:
 *   npm run questions:dedupe            # report only
 *   npm run questions:dedupe -- --apply # archive the duplicates
 */

function fingerprint(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N} ]+/gu, "");
}

const apply = process.argv.includes("--apply");

const questions = await prisma.question.findMany({
  where: { active: true, status: { not: "ARCHIVED" } },
  select: {
    id: true,
    code: true,
    text: true,
    status: true,
    reviewStatus: true,
    createdAt: true,
    _count: { select: { attempts: true, userAnswers: true, revisionItems: true, exams: true } },
  },
  orderBy: { createdAt: "asc" },
});

const groups = new Map<string, typeof questions>();
for (const question of questions) {
  const key = fingerprint(question.text);
  if (!key) continue;
  const list = groups.get(key) ?? [];
  list.push(question);
  groups.set(key, list);
}

const duplicates = [...groups.values()].filter((list) => list.length > 1);
const archiveIds: string[] = [];
const relink: { from: string; to: string }[] = [];

for (const group of duplicates) {
  const ranked = [...group].sort((left, right) => {
    const reviewRank = (value: (typeof group)[number]) =>
      value.status === "PUBLISHED" && value.reviewStatus === "REVIEWED" ? 0 : 1;
    return (
      reviewRank(left) - reviewRank(right) ||
      right._count.exams - left._count.exams ||
      left.createdAt.getTime() - right.createdAt.getTime()
    );
  });
  const [keep, ...rest] = ranked;
  console.log(`\nkeep ${keep.code} (${keep.id}) "${keep.text.slice(0, 80)}"`);
  for (const row of rest) {
    console.log(`  dup ${row.code} (${row.id}) exams=${row._count.exams} attempts=${row._count.attempts}`);
    archiveIds.push(row.id);
    relink.push({ from: row.id, to: keep.id });
  }
}

console.log(
  `\n${duplicates.length} duplicated stem(s), ${archiveIds.length} row(s) to archive, ${questions.length} active rows scanned.`,
);

if (!archiveIds.length) {
  await prisma.$disconnect();
  process.exit(0);
}

if (!apply) {
  console.log("Dry run. Re-run with --apply to archive the duplicates.");
  await prisma.$disconnect();
  process.exit(0);
}

for (const { from, to } of relink) {
  const links = await prisma.questionExam.findMany({
    where: { questionId: from },
    select: { examId: true, status: true, active: true, marks: true, negativeMarks: true, scoringMode: true, sourceYear: true, category: true },
  });
  for (const link of links) {
    await prisma.questionExam.upsert({
      where: { questionId_examId: { questionId: to, examId: link.examId } },
      create: { ...link, questionId: to, examId: link.examId },
      update: {},
    });
  }
  await prisma.questionExam.deleteMany({ where: { questionId: from } });
}

const result = await prisma.question.updateMany({
  where: { id: { in: archiveIds } },
  data: { active: false, status: "ARCHIVED" },
});
console.log(`Archived ${result.count} duplicate row(s) and moved their exam links to the kept row.`);
await prisma.$disconnect();
