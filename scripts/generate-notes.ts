import "dotenv/config";
import { prisma } from "../src/server/db";
import { generateTopicNotesBatch } from "../src/server/ai/tasks";
import { getOfficialSyllabusExcerpt } from "../src/server/platform/syllabus-sources";

/**
 * Fills the learning centre with detailed, original notes for topics that have
 * no substantial notes yet. Notes are written from the imported official
 * syllabus and stored as a StudyMaterial row titled
 * "AI-generated detailed notes" so they are clearly distinguishable from
 * curated notes and external resources.
 *
 * Usage:
 *   npm run generate:notes -- --exam=NEET
 *   npm run generate:notes -- --exam=NEET --limit=6 --batch=4
 *   npm run generate:notes -- --exam=NEET --force
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
  const value = Number(flag(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const examCode = flag("exam");
if (!examCode || examCode === "true") {
  console.error("Pass the exam code, for example: npm run generate:notes -- --exam=NEET");
  process.exit(1);
}

const model = flag("model") ?? process.env.GENERATE_MODEL ?? "gemini-3.5-flash-lite";
const batchSize = Math.min(6, Math.max(2, num("batch", 4)));
const requestLimit = num("limit", 100);
const force = has("force");
const NOTE_TITLE = "AI-generated detailed notes";

const exam = await prisma.exam.findUnique({ where: { code: examCode }, select: { id: true, code: true, name: true } });
if (!exam) {
  console.error(`Unknown exam code ${examCode}.`);
  process.exit(1);
}

const topics = await prisma.syllabusTopic.findMany({
  where: { active: true, chapter: { unit: { examId: exam.id } } },
  orderBy: [{ chapter: { unit: { order: "asc" } } }, { chapter: { order: "asc" } }, { order: "asc" }],
  select: {
    id: true,
    title: true,
    description: true,
    content: true,
    chapterId: true,
    chapter: { select: { title: true, unitId: true, unit: { select: { title: true, subject: { select: { id: true, name: true } } } } } },
    materials: { where: { active: true, title: NOTE_TITLE }, select: { id: true, content: true } },
  },
});

const missing = topics.filter((topic) => {
  const aiNote = topic.materials[0];
  if (force) return true;
  if ((aiNote?.content ?? "").length > 400) return false;
  return (topic.content ?? "").trim().length < 400;
});

console.log(
  `${exam.name}: ${topics.length} topics, ${missing.length} without substantial notes, ${topics.length - missing.length} already covered.`,
);
if (!missing.length) {
  await prisma.$disconnect();
  process.exit(0);
}

const chapters = new Map<string, typeof missing>();
for (const topic of missing) {
  const list = chapters.get(topic.chapterId) ?? [];
  list.push(topic);
  chapters.set(topic.chapterId, list);
}

let requests = 0;
let written = 0;
let failures = 0;
let blocked: string | null = null;

for (const chapterTopics of chapters.values()) {
  const { chapter } = chapterTopics[0];
  const subject = chapter.unit.subject;
  for (let offset = 0; offset < chapterTopics.length; offset += batchSize) {
    if (requests >= requestLimit || blocked) break;
    const batch = chapterTopics.slice(offset, offset + batchSize);
    const topicBlocks = await Promise.all(
      batch.map(async (topic) => {
        const excerpt = await getOfficialSyllabusExcerpt(exam.id, subject.id, topic.title, topic.description);
        return {
          title: topic.title,
          description: topic.description ?? "",
          syllabusText: excerpt?.text ?? "",
        };
      }),
    );

    requests += 1;
    process.stdout.write(
      `\n[${chapter.unit.title} › ${chapter.title}] ${batch.length} topic(s), request ${requests}/${requestLimit} ... `,
    );
    const result = await generateTopicNotesBatch({
      examName: exam.name,
      subjectName: subject.name,
      chapterTitle: chapter.title,
      topics: topicBlocks,
      examId: exam.id,
      model,
    });
    if (!result.ok) {
      failures += 1;
      console.log(`FAILED (${result.code}) ${result.message.slice(0, 180)}`);
      if (result.code === "QUOTA") {
        blocked = result.message;
        break;
      }
      if (failures >= 3) {
        blocked = "three consecutive provider failures";
        break;
      }
      continue;
    }
    failures = 0;
    console.log(`received ${result.data.length}`);

    const byTitle = new Map(batch.map((topic) => [normalize(topic.title), topic]));
    const usedTopicIds = new Set<string>();
    for (const note of result.data) {
      const normalized = normalize(note.topic);
      const topic =
        byTitle.get(normalized) ??
        batch.find((candidate) => {
          const key = normalize(candidate.title);
          return !usedTopicIds.has(candidate.id) && (key.includes(normalized) || normalized.includes(key));
        }) ??
        batch.find((candidate) => !usedTopicIds.has(candidate.id));
      if (!topic) continue;
      usedTopicIds.add(topic.id);
      const content = [
        "## Overview",
        note.overview,
        "",
        "## Key points",
        ...note.keyPoints.map((point) => `- ${point}`),
        ...(note.formulas.length ? ["", "## Formulas", ...note.formulas.map((formula) => `- ${formula}`)] : []),
        ...(note.workedExample
          ? ["", "## Worked example", `**Question:** ${note.workedExample.question}`, "", `**Solution:** ${note.workedExample.solution}`]
          : []),
        ...(note.commonMistakes.length ? ["", "## Common mistakes", ...note.commonMistakes.map((item) => `- ${item}`)] : []),
      ].join("\n");

      const existing = topic.materials[0];
      if (existing) {
        await prisma.studyMaterial.update({
          where: { id: existing.id },
          data: { content, active: true, title: NOTE_TITLE, type: "NOTES", order: -1 },
        });
      } else {
        await prisma.studyMaterial.create({
          data: { topicId: topic.id, title: NOTE_TITLE, type: "NOTES", content, order: -1, active: true },
        });
      }
      written += 1;
    }
  }
  if (requests >= requestLimit || blocked) break;
}

console.log(`\n=== Result ===`);
console.log(`Wrote/updated ${written} topic note(s) with ${requests} AI request(s).`);
if (blocked) console.log(`Stopped early: ${blocked}`);
await prisma.$disconnect();
process.exit(blocked ? 2 : 0);

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
