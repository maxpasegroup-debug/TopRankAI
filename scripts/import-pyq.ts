/**
 * Previous-year question (PYQ) importer.
 *
 *   npx tsx scripts/import-pyq.ts --file=prisma/pyq/template.json            # dry run
 *   npx tsx scripts/import-pyq.ts --file=prisma/pyq/your-file.json --apply   # write drafts
 *
 * The importer only accepts a structured file that a human has prepared from
 * an official paper. It never copies text from a PDF automatically and never
 * marks a question as reviewed: every row lands in the admin queue as a DRAFT
 * with `sourceType = PREVIOUS_YEAR`.
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { databaseUrl } from "../src/server/env";
import { z } from "zod";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl() }) });

const questionSchema = z.object({
  year: z.number().int().min(1990).max(2100),
  subjectCode: z.string().min(2).max(60),
  topic: z.string().max(200).optional(),
  type: z.enum(["SINGLE_CHOICE", "MULTIPLE_CHOICE", "NUMERICAL"]).default("SINGLE_CHOICE"),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("MEDIUM"),
  text: z.string().min(10).max(6000),
  options: z.array(z.object({ text: z.string().min(1).max(600), correct: z.boolean() })).max(6).default([]),
  numericalAnswer: z.string().max(120).optional(),
  explanation: z.string().max(4000).optional(),
  sourceUrl: z.string().url().max(600).optional(),
});

const fileSchema = z.object({
  examCode: z.string().min(1).max(40),
  sourceUrl: z.string().url().max(600).optional(),
  questions: z.array(questionSchema).min(1).max(500),
});

const args = process.argv.slice(2);
const filePath = args.find((arg) => arg.startsWith("--file="))?.split("=")[1];
const apply = args.includes("--apply");

function checksumFor(examCode: string, year: number, text: string) {
  return createHash("sha256").update(`${examCode}:${year}:${text.trim().toLowerCase()}`).digest("hex");
}

async function main() {
  if (!filePath) {
    console.log("Pass --file=path/to/questions.json (see prisma/pyq/README.md).");
    return;
  }
  const { readFile } = await import("node:fs/promises");
  const parsed = fileSchema.safeParse(JSON.parse(await readFile(filePath, "utf8")));
  if (!parsed.success) {
    console.error("Invalid PYQ file:", parsed.error.issues.slice(0, 6));
    process.exitCode = 1;
    return;
  }

  const { examCode, sourceUrl, questions } = parsed.data;
  const exam = await prisma.exam.findUnique({
    where: { code: examCode },
    select: { id: true, code: true, name: true, configuration: { select: { positiveMarks: true, negativeMarks: true } } },
  });
  if (!exam) {
    console.error(`Unknown exam code: ${examCode}`);
    process.exitCode = 1;
    return;
  }

  const marks = Number(exam.configuration?.positiveMarks ?? 1);
  const negativeMarks = Number(exam.configuration?.negativeMarks ?? 0);

  let created = 0;
  let skipped = 0;
  for (const [index, question] of questions.entries()) {
    if (question.type === "NUMERICAL" ? !question.numericalAnswer : question.options.filter((option) => option.correct).length === 0) {
      console.warn(`#${index + 1}: skipped — missing answer key.`);
      skipped += 1;
      continue;
    }
    const subject = await prisma.subject.findUnique({ where: { code: question.subjectCode }, select: { id: true } });
    if (!subject) {
      console.warn(`#${index + 1}: skipped — unknown subject ${question.subjectCode}.`);
      skipped += 1;
      continue;
    }
    const topic = question.topic
      ? await prisma.syllabusTopic.findFirst({
          where: { title: { equals: question.topic, mode: "insensitive" }, chapter: { unit: { examId: exam.id } } },
          select: { id: true, chapterId: true },
        })
      : null;
    const checksum = checksumFor(examCode, question.year, question.text);
    console.log(`${apply ? "import" : "would import"}  ${examCode} ${question.year}  ${question.text.slice(0, 70)}…`);
    if (!apply) continue;

    const code = `PYQ-${examCode}-${question.year}-${String(index + 1).padStart(3, "0")}-${checksum.slice(0, 6)}`;
    const record = await prisma.question.upsert({
      where: { checksum },
      update: {},
      create: {
        code,
        text: question.text,
        type: question.type,
        difficulty: question.difficulty,
        status: "DRAFT",
        active: true,
        reviewStatus: "NEEDS_REVIEW",
        sourceType: "PREVIOUS_YEAR",
        sourceYear: question.year,
        source: question.sourceUrl ?? sourceUrl ?? null,
        subjectId: subject.id,
        chapterId: topic?.chapterId ?? null,
        topicId: topic?.id ?? null,
        explanation: question.explanation ?? null,
        numericalAnswer: question.numericalAnswer ?? null,
        marks,
        negativeMarks,
        checksum,
        tags: ["previous-year", examCode, String(question.year)],
        options: question.type === "NUMERICAL"
          ? undefined
          : { create: question.options.map((option, order) => ({ code: String.fromCharCode(65 + order), text: option.text, isCorrect: option.correct, order })) },
      },
      select: { id: true },
    });
    await prisma.questionExam.upsert({
      where: { questionId_examId: { questionId: record.id, examId: exam.id } },
      update: { marks, negativeMarks },
      create: { questionId: record.id, examId: exam.id, marks, negativeMarks, status: "DRAFT", active: true },
    });
    created += 1;
  }

  if (apply) {
    console.log(`\nCreated ${created} draft question${created === 1 ? "" : "s"}; skipped ${skipped}. Approve them in the admin console before they can enter a paper.`);
  } else {
    console.log(`\nDry run complete for ${questions.length} question${questions.length === 1 ? "" : "s"}. Re-run with --apply to write drafts.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
