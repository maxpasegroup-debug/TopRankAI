import "dotenv/config";
import { prisma } from "../src/server/db";

/**
 * Reuses an AI note across exams when the subject and topic title match. The
 * same Physics topic (for example "Laws of Motion") appears in NEET, JEE Main,
 * JEE Advanced and KEAM; copying the note is better than paying to regenerate
 * identical content and keeps one canonical explanation per subject/topic.
 *
 * Only topics without an AI note are touched, and each topic can hold at most
 * one "AI-generated detailed notes" row.
 *
 * Usage:
 *   npm run notes:share            # report only
 *   npm run notes:share -- --apply # write the shared notes
 */

const apply = process.argv.includes("--apply");
const TITLE = "AI-generated detailed notes";

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const topics = await prisma.syllabusTopic.findMany({
  where: { active: true },
  select: {
    id: true,
    title: true,
    chapter: { select: { unit: { select: { subject: { select: { code: true } } } } } },
    materials: { where: { active: true, title: TITLE }, select: { content: true }, take: 1 },
  },
});

const canonical = new Map<string, string>();
for (const topic of topics) {
  const content = topic.materials[0]?.content;
  if (!content || content.length < 400) continue;
  const key = `${topic.chapter.unit.subject.code}:${normalize(topic.title)}`;
  if (!canonical.has(key)) canonical.set(key, content);
}
console.log(`${canonical.size} canonical subject/topic note(s) available.`);

const targets = topics.filter((topic) => !(topic.materials[0]?.content));
const matches = targets.flatMap((topic) => {
  const key = `${topic.chapter.unit.subject.code}:${normalize(topic.title)}`;
  const content = canonical.get(key);
  return content ? [{ topicId: topic.id, title: topic.title, content }] : [];
});

console.log(`${targets.length} topic(s) without notes, ${matches.length} can reuse a matching note.`);
for (const match of matches.slice(0, 20)) console.log(`  ${match.title}`);

if (!apply || !matches.length) {
  console.log(apply ? "Nothing to write." : "Dry run. Re-run with --apply to write.");
  await prisma.$disconnect();
  process.exit(0);
}

let written = 0;
for (const match of matches) {
  await prisma.studyMaterial.create({
    data: { topicId: match.topicId, title: TITLE, type: "NOTES", content: match.content, order: -1, active: true },
  });
  written += 1;
}
console.log(`Shared ${written} note(s).`);
await prisma.$disconnect();
