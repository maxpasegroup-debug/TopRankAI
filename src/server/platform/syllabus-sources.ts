import { cache } from "react";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import manifest from "../../../syllabus/sources.json";
import { prisma } from "@/server/db";
import { matchingSection } from "./syllabus-sections";

type Document = { label: string; url: string; content: string; note?: string; syllabusUrl?: string };

export const getSyllabusDocuments = cache(async (examId: string, subjectId: string | null, code: string) => {
  const imported = await prisma.syllabusSource.findMany({
    where: { examId, kind: "SYLLABUS", status: "IMPORTED", content: { not: null },
      ...(subjectId ? { OR: [{ subjectId: null }, { subjectId }] } : {}) },
    select: { label: true, url: true, content: true },
    orderBy: { fetchedAt: "desc" },
  });
  const documents = new Map<string, Document>();
  for (const row of imported) if (row.content) documents.set(row.url, { ...row, content: row.content });
  // Earlier imports stored only the beginning of long notices. The checked-in
  // archive also supplies complete documents on newly seeded installations.
  for (const source of manifest.filter((source) => source.examCode === code)) {
    const slug = source.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
    const archive = await readFile(join(process.cwd(), "syllabus", source.examCode, slug + ".txt"), "utf8");
    const stored = documents.get(source.url);
    documents.set(source.url, { ...source, content: stored && stored.content.length > archive.length ? stored.content : archive });
  }
  return [...documents.values()];
});

export type SyllabusExcerpt = { text: string; sources: { label: string; url: string }[] };

export const getOfficialSyllabusExcerpt = cache(async (
  examId: string, subjectId: string | null, title: string, description?: string | null,
  chapter = "", subject = "", examCode?: string,
): Promise<SyllabusExcerpt | null> => {
  const code = examCode ?? (await prisma.exam.findUnique({ where: { id: examId }, select: { code: true } }))?.code ?? "";
  const documents = await getSyllabusDocuments(examId, subjectId, code);
  let best: { text: string; score: number; source: Document } | null = null;
  for (const source of documents) {
    const match = matchingSection(source.content, code, title, chapter, description ?? "", subject);
    if (match && (!best || match.score > best.score)) best = { ...match, source };
  }
  return best ? { text: best.text, sources: [{ url: best.source.url, label: best.source.label }] } : null;
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
