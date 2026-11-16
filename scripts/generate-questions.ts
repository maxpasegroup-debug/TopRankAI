import "dotenv/config";
import { createHash } from "node:crypto";
import { prisma } from "../src/server/db";
import { generatePaperQuestions } from "../src/server/ai/tasks";
import { findExamPart, readExamPattern } from "../src/server/platform/patterns";
import { getOfficialSyllabusExcerpt } from "../src/server/platform/syllabus-sources";

/**
 * Authors full-length papers with Gemini, grounded in the official syllabus
 * documents imported by `npm run syllabus:sync`.
 *
 * The script fills each section of the real exam pattern up to its official
 * question count, so NEET reaches 45 Physics + 45 Chemistry + 90 Biology = 180
 * instead of a short sample. Every batch is written against the imported
 * syllabus passages, the topic list of the section, and a list of stems already
 * in the bank. Questions are rejected when they fail structural validation or
 * duplicate an existing stem (exact or near-exact), then stored with
 * sourceType AI_GENERATED, a checksum and a syllabus topic link.
 *
 * Usage:
 *   npm run generate:questions -- --exam=NEET
 *   npm run generate:questions -- --exam=NEET --target=20 --batch=10
 *   npm run generate:questions -- --exam=JEE_MAIN --part=PAPER_1 --model=gemini-3.5-flash-lite
 *   npm run generate:questions -- --exam=NEET --dry-run
 *   npm run generate:questions -- --exam=NEET --review   # leave rows in NEEDS_REVIEW
 *   npm run generate:questions -- --exam=NEET --requests=2  # cap AI calls this run
 */

const args = process.argv.slice(2);
const flag = (name: string) => {
  const inline = args.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const index = args.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const next = args[index + 1];
  return next && !next.startsWith("--") ? next : "true";
};
const has = (name: string) => args.includes(`--${name}`);
const num = (name: string, fallback: number) => {
  const raw = flag(name);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const examCode = flag("exam");
if (!examCode || examCode === "true") {
  console.error("Pass the exam code, for example: npm run generate:questions -- --exam=NEET");
  process.exit(1);
}

const model = flag("model") ?? process.env.GENERATE_MODEL ?? "gemini-3.5-flash-lite";
const batchSize = Math.min(20, Math.max(3, num("batch", 10)));
const maxRequests = num("requests", 10_000);
const dryRun = has("dry-run");
const leaveForReview = has("review");
const officialOnly = has("official");
const reviewStatus = leaveForReview ? "NEEDS_REVIEW" : "REVIEWED";

const exam = await prisma.exam.findUnique({
  where: { code: examCode },
  select: {
    id: true,
    code: true,
    name: true,
    configuration: { select: { sections: true, sourceUrl: true } },
  },
});
if (!exam) {
  console.error(`Unknown exam code ${examCode}.`);
  process.exit(1);
}

const pattern = readExamPattern(exam.configuration?.sections ?? null);
const part = findExamPart(pattern, flag("part") === "true" ? null : flag("part"));
if (!part) {
  console.error(`${exam.code} has no exam pattern, so section quotas are unknown. Add the official pattern first.`);
  process.exit(1);
}

const officialTotal = Math.max(1, part.totalQuestions || part.sections.reduce((sum, section) => sum + section.questionCount, 0));
const target = Math.min(officialTotal, num("target", officialTotal));
const sections = part.sections.filter((section) => section.subjectCode && section.questionCount > 0);
if (!sections.length) {
  console.error(`${exam.code} ${part.code} has no sections with a subject code, so questions cannot be mapped.`);
  process.exit(1);
}

/** Apportion the run target across sections with the largest-remainder method. */
const scale = target / officialTotal;
const rawQuotas = sections.map((section) => section.questionCount * scale);
const quotas = rawQuotas.map(Math.floor);
let remainder = target - quotas.reduce((sum, value) => sum + value, 0);
const order = rawQuotas
  .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
  .sort((left, right) => right.fraction - left.fraction);
for (const entry of order) {
  if (remainder <= 0) break;
  quotas[entry.index] += 1;
  remainder -= 1;
}

const subjects = await prisma.subject.findMany({
  where: { code: { in: [...new Set(sections.map((section) => section.subjectCode!))] } },
  select: { id: true, code: true, name: true },
});
const subjectByCode = new Map(subjects.map((subject) => [subject.code, subject]));

const bank = await prisma.question.findMany({
  where: { status: "PUBLISHED", active: true, reviewStatus: "REVIEWED" },
  select: {
    id: true,
    text: true,
    checksum: true,
    subject: { select: { code: true } },
    exams: { where: { examId: exam.id }, select: { id: true } },
  },
  orderBy: { createdAt: "desc" },
  take: 5_000,
});

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N} ]+/gu, "")
    .trim();
}
function tokens(value: string) {
  return new Set(normalizeText(value).split(" ").filter((word) => word.length >= 3));
}
function similarity(left: Set<string>, right: Set<string>) {
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / (left.size + right.size - shared);
}

const seen = new Map<string, { tokens: Set<string>; id: string }>();
const linkedToExam = new Set<string>();
const existingBySubject = new Map<string, number>();
for (const question of bank) {
  const inExam = question.exams.length > 0;
  if (inExam) {
    linkedToExam.add(question.id);
    existingBySubject.set(question.subject.code, (existingBySubject.get(question.subject.code) ?? 0) + 1);
  }
  seen.set(normalizeText(question.text), { tokens: tokens(question.text), id: question.id });
}

console.log(`${exam.name} · ${part.name} · official ${officialTotal} questions / ${part.totalMarks} marks`);
console.log(`Target ${target}; model ${model}; batch ${batchSize}; rows will be ${reviewStatus}.`);
console.log(
  `Existing reviewed bank: ${linkedToExam.size} question(s) ${JSON.stringify(Object.fromEntries(existingBySubject))}`,
);

const remainingBank = new Map(existingBySubject);
const plan = sections.map((section, index) => {
  const subject = subjectByCode.get(section.subjectCode!);
  const quota = quotas[index];
  const have = remainingBank.get(section.subjectCode!) ?? 0;
  const need = Math.max(0, quota - have);
  remainingBank.set(section.subjectCode!, Math.max(0, have - quota));
  return { section, subject, quota, have, need };
});

for (const row of plan) {
  console.log(
    `  ${row.section.name.padEnd(30)} quota ${String(row.quota).padStart(3)} · bank ${String(row.have).padStart(3)} · to write ${String(row.need).padStart(3)}` +
      (row.subject ? "" : "  [no matching subject row - skipped]"),
  );
}

if (dryRun) {
  console.log("\nDry run: no AI calls and no database writes.");
  await prisma.$disconnect();
  process.exit(0);
}

const avoidStems = bank
  .filter((question) => linkedToExam.has(question.id) && question.text.length > 20)
  .slice(0, 24)
  .map((question) => question.text);

let requestsUsed = 0;
let inserted = 0;
let reused = 0;
let rejectedDuplicate = 0;
let rejectedInvalid = 0;
let consecutiveFailures = 0;
let blocked: string | null = null;
const perSection: Record<string, { planned: number; written: number }> = {};

for (const row of plan) {
  if (!row.subject || row.need <= 0 || blocked) continue;
  perSection[row.section.name] = { planned: row.need, written: 0 };

  type WorkingTopic = { id: string | null; title: string; description: string | null };
  let topics: WorkingTopic[];
  let officialText = "";
  let officialUrls: string[] = [];

  if (officialOnly) {
    const sources = await prisma.syllabusSource.findMany({
      where: { examId: exam.id, status: "IMPORTED", content: { not: null } },
      orderBy: { fetchedAt: "desc" },
      select: { label: true, url: true, content: true },
    });
    officialText = sources.map((source) => source.content ?? "").join("\n\n").trim().slice(0, 10_000);
    officialUrls = [...new Set(sources.map((source) => source.url))].slice(0, 3);
    const headings = [
      ...new Set(
        officialText
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => /^(section|unit|part)\s+[\divxlc]+[\s:.-]/i.test(line) && line.length <= 160),
      ),
    ].slice(0, 30);
    topics = headings.map((title) => ({ id: null, title, description: null }));
    if (!officialText || topics.length < 2) {
      console.log(`\n${row.section.name}: the imported document has no usable section headings; skipped.`);
      continue;
    }
    console.log(`\n=== ${row.section.name}: writing ${row.need} question(s) from the official document (${topics.length} headings) ===`);
  } else {
    topics = await prisma.syllabusTopic.findMany({
      where: { chapter: { unit: { examId: exam.id, subjectId: row.subject.id } } },
      select: { id: true, title: true, description: true },
      orderBy: [{ chapter: { order: "asc" } }, { order: "asc" }],
    });
    if (!topics.length) {
      console.log(`\n${row.section.name}: no syllabus topics mapped to ${row.subject.name}; skipped.`);
      continue;
    }
    console.log(`\n=== ${row.section.name}: writing ${row.need} question(s) from ${topics.length} topics ===`);
  }

  const topicList = topics.map((topic) => `- ${topic.title}: ${(topic.description ?? "").slice(0, 180)}`).join("\n");

  let remaining = row.need;
  let cursor = 0;
  while (remaining > 0 && requestsUsed < maxRequests && !blocked) {
    const count = Math.min(batchSize, remaining);
    const focus = Array.from({ length: Math.min(4, topics.length) }, (_, offset) => topics[(cursor + offset) % topics.length]);
    cursor += focus.length;

    let syllabusText: string;
    let sourceReferences: string[];
    if (officialOnly) {
      syllabusText = officialText.slice(0, 8_000);
      sourceReferences = officialUrls;
    } else {
      const excerpts = await Promise.all(
        focus.map((topic) => getOfficialSyllabusExcerpt(exam.id, row.subject!.id, topic.title, topic.description)),
      );
      syllabusText = [...new Set(excerpts.flatMap((excerpt) => (excerpt ? [excerpt.text] : [])))]
        .join("\n\n")
        .slice(0, 6_000);
      sourceReferences = [
        ...new Set(excerpts.flatMap((excerpt) => (excerpt ? excerpt.sources.map((source) => source.url) : []))),
      ].slice(0, 3);
    }

    const batchLabel = `${row.section.name} ${inserted + 1}-${inserted + count}`;
    process.stdout.write(`\n[${batchLabel}] requesting ${count} question(s) from ${focus.map((topic) => topic.title).join(", ")} ... `);
    requestsUsed += 1;
    const result = await generatePaperQuestions({
      examName: exam.name,
      sectionName: row.section.name,
      subjectName: row.subject.name,
      topics: topicList,
      syllabusText,
      count,
      examId: exam.id,
      model,
      sourceReferences,
      avoidStems,
    });

    if (!result.ok) {
      console.log(`FAILED (${result.code})`);
      console.log(`  ${result.message}`);
      consecutiveFailures += 1;
      if (result.code === "QUOTA") {
        blocked = result.message;
        break;
      }
      if (consecutiveFailures >= 3) {
        blocked = `three consecutive ${result.code} failures`;
        break;
      }
      continue;
    }
    consecutiveFailures = 0;
    console.log(`received ${result.data.length}`);

    const topicIndex = new Map(topics.map((topic) => [normalizeText(topic.title), topic]));
    const batchPrimary = focus[0];

    for (const draft of result.data) {
      const text = draft.text.trim();
      const key = normalizeText(text);
      if (!key) {
        rejectedInvalid += 1;
        continue;
      }
      if (seen.has(key)) {
        const known = seen.get(key)!;
        if (!linkedToExam.has(known.id)) {
          await prisma.questionExam.upsert({
            where: { questionId_examId: { questionId: known.id, examId: exam.id } },
            create: {
              questionId: known.id,
              examId: exam.id,
              status: "PUBLISHED",
              active: true,
              marks: row.section.marksPerQuestion > 0 ? row.section.marksPerQuestion : 1,
              negativeMarks: row.section.negativeMarks,
              category: row.section.name,
            },
            update: {},
          });
          linkedToExam.add(known.id);
          reused += 1;
          remaining -= 1;
          perSection[row.section.name].written += 1;
        } else {
          rejectedDuplicate += 1;
        }
        continue;
      }
      const draftTokens = tokens(text);
      let nearDuplicate = false;
      for (const known of seen.values()) {
        if (similarity(draftTokens, known.tokens) >= 0.82) {
          nearDuplicate = true;
          break;
        }
      }
      if (nearDuplicate) {
        rejectedDuplicate += 1;
        continue;
      }

      const options = draft.options.map((option) => option.trim());
      if (options.length !== 4 || new Set(options.map((option) => option.toLowerCase())).size !== 4) {
        rejectedInvalid += 1;
        continue;
      }
      if (!Number.isInteger(draft.correctIndex) || draft.correctIndex < 0 || draft.correctIndex > 3) {
        rejectedInvalid += 1;
        continue;
      }
      if (/\b(wait|let'?s check|let me|i need to|correct index|option index|index \d)\b/i.test(draft.explanation)) {
        rejectedInvalid += 1;
        continue;
      }

      const normalizedTopic = normalizeText(draft.topic);
      const topic =
        topicIndex.get(normalizedTopic) ??
        topics.find((candidate) => {
          const candidateKey = normalizeText(candidate.title);
          return candidateKey.includes(normalizedTopic) || normalizedTopic.includes(candidateKey);
        }) ??
        batchPrimary;

      const checksum = createHash("sha256").update(key).digest("hex").slice(0, 40);
      const marks = row.section.marksPerQuestion > 0 ? row.section.marksPerQuestion : Number(part.totalMarks) / officialTotal;
      const negativeMarks = row.section.negativeMarks;
      const grounded = syllabusText.length > 0;
      const sourceLabel = grounded
        ? `AI-authored from the official syllabus (${model}, ${new Date().toISOString().slice(0, 10)})`
        : `AI-authored from the curated topic map; the exam authority publishes no topic list (${model}, ${new Date().toISOString().slice(0, 10)})`;
      const explanation = draft.explanation.trim().slice(0, 1_400);

      const created = await prisma.question
        .create({
          data: {
            code: `AI-${exam.code}-${checksum.slice(0, 12)}`,
            text,
            type: "SINGLE_CHOICE",
            difficulty: draft.difficulty,
            status: "PUBLISHED",
            active: true,
            subjectId: row.subject.id,
            topicId: topic.id,
            explanation,
            source: sourceLabel,
            sourceType: "AI_GENERATED",
            marks,
            negativeMarks,
            syllabusRef: officialOnly ? `${topic.title} (official syllabus)` : topic.title,
            checksum,
            reviewStatus: reviewStatus as "REVIEWED" | "NEEDS_REVIEW",
            approvedAt: reviewStatus === "REVIEWED" ? new Date() : null,
            language: "en",
            tags: grounded
              ? ["AI_GENERATED", "SYLLABUS_GROUNDED", row.section.name]
              : ["AI_GENERATED", "CURATED_TOPICS", row.section.name],
            options: {
              create: options.map((option, index) => ({
                code: String.fromCharCode(65 + index),
                text: option.slice(0, 600),
                order: index,
                isCorrect: index === draft.correctIndex,
              })),
            },
            exams: {
              create: {
                examId: exam.id,
                status: "PUBLISHED",
                active: true,
                marks,
                negativeMarks,
                category: row.section.name,
              },
            },
          },
          select: { id: true },
        })
        .catch(async (error: unknown) => {
          // The checksum is unique. If a row with this content already exists
          // (for example from another exam run), link it instead of duplicating.
          const message = String(error);
          if (!message.includes("checksum")) {
            console.log(`\n  skipped insert: ${message.slice(0, 300)}`);
            return null;
          }
          const existingRow = await prisma.question.findUnique({ where: { checksum }, select: { id: true } });
          if (!existingRow) return null;
          await prisma.questionExam.upsert({
            where: { questionId_examId: { questionId: existingRow.id, examId: exam.id } },
            create: {
              questionId: existingRow.id,
              examId: exam.id,
              status: "PUBLISHED",
              active: true,
              marks,
              negativeMarks,
              category: row.section.name,
            },
            update: {},
          });
          linkedToExam.add(existingRow.id);
          reused += 1;
          remaining -= 1;
          perSection[row.section.name].written += 1;
          return { id: existingRow.id, reused: true };
        });
      if (!created) {
        rejectedDuplicate += 1;
        continue;
      }

      seen.set(key, { tokens: draftTokens, id: created.id });
      avoidStems.unshift(text);
      if (avoidStems.length > 24) avoidStems.pop();
      if (!("reused" in created)) {
        inserted += 1;
        remaining -= 1;
        perSection[row.section.name].written += 1;
      }
      linkedToExam.add(created.id);
    }
  }

  if (remaining > 0 && !blocked) {
    console.log(`\n${row.section.name}: ${remaining} question(s) still missing after this run.`);
  }
}

console.log(`\n=== Result ===`);
console.log(`Inserted ${inserted} question(s), reused ${reused} existing row(s) across ${Object.keys(perSection).length} section(s); ${requestsUsed} AI request(s).`);
for (const [name, row] of Object.entries(perSection)) {
  console.log(`  ${name.padEnd(30)} ${row.written}/${row.planned}`);
}
console.log(`Rejected: ${rejectedDuplicate} duplicate(s), ${rejectedInvalid} structurally invalid.`);
if (blocked) console.log(`Stopped early: ${blocked}`);
await prisma.$disconnect();
process.exit(blocked ? 2 : 0);
