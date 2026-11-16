import { cache } from "react";
import { prisma } from "@/server/db";

const STOP_WORDS = new Set([
  "and", "the", "with", "from", "that", "this", "their", "into", "your", "about", "using",
  "apply", "find", "solve", "analyse", "analyze", "understand", "identify", "describe",
]);

function keywords(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word));
}

function normalizeDocument(text: string) {
  return text.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Cuts a window around a keyword match so the excerpt carries the matched
 * phrase with surrounding context instead of an arbitrary fixed offset. Where
 * possible the window starts at the nearest syllabus section heading so the
 * prompt receives a coherent block rather than a mid-sentence fragment.
 */
function windowAround(text: string, position: number, before = 380, after = 1_300) {
  const earliest = Math.max(0, position - Math.max(before, 900));
  const lookbehind = text.slice(earliest, position).toLowerCase();
  let start = Math.max(0, position - before);
  for (const marker of ["\nunit ", "\n\nunit ", "\npart ", "\n\n"]) {
    const index = lookbehind.lastIndexOf(marker);
    if (index === -1) continue;
    const candidate = earliest + index + (marker.startsWith("\n\n") ? 2 : 1);
    if (candidate <= start) start = candidate;
    break;
  }
  const end = Math.min(text.length, position + after);
  return text.slice(start, end).trim();
}

export type SyllabusExcerpt = {
  text: string;
  sources: { label: string; url: string }[];
};

/**
 * Finds the part of the imported official syllabus that best matches a topic.
 * The returned text is injected into AI prompts, so generated questions stay
 * anchored to a real official document instead of model memory.
 */
export const getOfficialSyllabusExcerpt = cache(async (
  examId: string,
  subjectId: string | null,
  title: string,
  description?: string | null,
): Promise<SyllabusExcerpt | null> => {
  const sources = await prisma.syllabusSource.findMany({
    where: {
      examId,
      status: "IMPORTED",
      content: { not: null },
      ...(subjectId ? { OR: [{ subjectId: null }, { subjectId }] } : {}),
    },
    orderBy: [{ subjectId: "desc" }, { fetchedAt: "desc" }],
    take: 10,
    select: { label: true, url: true, content: true, subjectId: true },
  });
  if (!sources.length) return null;

  const titleLower = title.toLowerCase();
  const titleWords = [...new Set(keywords(title))];
  const descriptionWords = [...new Set(keywords(description ?? ""))].filter((word) => !titleWords.includes(word));
  const scored: { text: string; score: number; position: number; label: string; url: string; sourceId: number }[] = [];
  sources.forEach((source, sourceIndex) => {
    const body = normalizeDocument(source.content ?? "");
    const haystack = body.toLowerCase();
    const anchors = new Set<number>();

    if (titleLower.length >= 4) {
      let index = haystack.indexOf(titleLower);
      while (index !== -1 && anchors.size < 12) {
        anchors.add(index);
        index = haystack.indexOf(titleLower, index + titleLower.length);
      }
    }
    for (const word of titleWords) {
      if (word.length < 5) continue;
      let index = haystack.indexOf(word);
      let hits = 0;
      while (index !== -1 && hits < 4) {
        anchors.add(index);
        hits += 1;
        index = haystack.indexOf(word, index + word.length);
      }
    }
    if (!anchors.size) return;

    for (const position of anchors) {
      const window = windowAround(body, position);
      const lower = window.toLowerCase();
      let score = 0;
      for (const word of titleWords) {
        if (lower.includes(word)) score += 10;
      }
      if (titleLower.length >= 4 && lower.includes(titleLower)) score += 15;
      for (const word of descriptionWords) {
        if (word.length >= 5 && lower.includes(word)) score += 1;
      }
      if (source.subjectId) score += 2;
      // Longer windows carry more usable syllabus context for the prompt.
      score += Math.min(3, Math.floor(window.length / 500));
      if (score > 0) scored.push({ text: window, score, position, label: source.label, url: source.url, sourceId: sourceIndex });
    }
  });
  if (!scored.length) return null;

  const chosen: typeof scored = [];
  for (const candidate of scored.sort((left, right) => right.score - left.score)) {
    const overlaps = chosen.some((item) => {
      if (item.sourceId !== candidate.sourceId) return false;
      const [start, end] = candidate.position < item.position
        ? [candidate.position, item.position]
        : [item.position, candidate.position];
      return end - start < 800;
    });
    if (overlaps) continue;
    chosen.push(candidate);
    if (chosen.length === 3) break;
  }

  const text = chosen.map((item) => item.text).join("\n\n").slice(0, 2_400);
  const seen = new Set<string>();
  const used = chosen.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
  return { text, sources: used.map((item) => ({ label: item.label, url: item.url })) };
});

export async function getSyllabusSourceStatus(examId: string) {
  const [counts, recent] = await Promise.all([
    prisma.syllabusSource.groupBy({ by: ["status"], where: { examId }, _count: { _all: true } }),
    prisma.syllabusSource.findMany({
      where: { examId },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: { id: true, label: true, url: true, format: true, status: true, error: true, fetchedAt: true },
    }),
  ]);
  return {
    imported: counts.find((row) => row.status === "IMPORTED")?._count._all ?? 0,
    failed: counts.find((row) => row.status === "FAILED")?._count._all ?? 0,
    pending: counts.find((row) => row.status === "PENDING")?._count._all ?? 0,
    recent,
  };
}
