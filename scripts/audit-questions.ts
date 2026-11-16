import "dotenv/config";
import { prisma } from "../src/server/db";

/**
 * Deterministic answer-key audit. It reads the final computed value in the
 * explanation (the last "= <option>" or "answer is <option>") and compares it
 * with the stored key. The goal is to catch a key that contradicts its own
 * explanation, as happened with a polygon-angle question whose explanation
 * proved 900 degrees while the key said 720.
 *
 * It reports only; it never rewrites a key.
 *
 * Usage: npx tsx scripts/audit-questions.ts [EXAM_CODE ...]
 */

const codes = process.argv.slice(2).map((code) => code.toUpperCase());
const questions = await prisma.question.findMany({
  where: {
    active: true,
    sourceType: "AI_GENERATED",
    ...(codes.length ? { exams: { some: { exam: { code: { in: codes } } } } } : {}),
  },
  select: {
    id: true,
    text: true,
    explanation: true,
    options: { orderBy: { order: "asc" }, select: { text: true, isCorrect: true } },
    exams: { select: { exam: { select: { code: true } } }, take: 1 },
  },
});

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").replace(/[^\p{L}\p{N} .%×^/=-]+/gu, "").trim();
}

const flagged: string[] = [];
for (const question of questions) {
  const explanation = normalize(question.explanation);
  const keys = question.options.map((option) => normalize(option.text));
  const keyIndex = question.options.findIndex((option) => option.isCorrect);
  if (keyIndex === -1) {
    flagged.push(`NO KEY  ${question.exams[0]?.exam.code ?? "?"}  ${question.text.slice(0, 100)}`);
    continue;
  }

  // Last option value that the explanation presents as a computed result.
  let last: { index: number; position: number } | null = null;
  for (const [index, text] of keys.entries()) {
    if (text.length < 2) continue;
    const pattern = new RegExp(`(?:=|answer is|result(?:s|ing)? in|gives)\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g");
    for (const match of explanation.matchAll(pattern)) {
      const position = match.index ?? 0;
      if (!last || position > last.position) last = { index, position };
    }
  }
  if (last && last.index !== keyIndex) {
    flagged.push(
      `MISMATCH ${question.exams[0]?.exam.code ?? "?"}  key="${question.options[keyIndex].text}"  explained="${question.options[last.index].text}"\n  ${question.text.slice(0, 170)}`,
    );
  }
}

console.log(`${questions.length} AI question(s) audited, ${flagged.length} needing review.`);
for (const line of flagged.slice(0, 80)) console.log(`\n${line}`);
if (flagged.length > 80) console.log(`\n... ${flagged.length - 80} more`);
await prisma.$disconnect();
