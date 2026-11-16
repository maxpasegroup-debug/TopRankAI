import "dotenv/config";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { prisma } from "../src/server/db";

/**
 * Downloads the official syllabus documents for every active exam, keeps the
 * original file under ./syllabus/<EXAM>/ and stores the extracted text in the
 * database as a SyllabusSource. Text extraction is local (pypdf) so it does not
 * depend on an AI quota.
 *
 * Usage:
 *   npm run syllabus:sync                 # every source in syllabus/sources.json
 *   npm run syllabus:sync -- --exam=NEET  # one exam
 *   npm run syllabus:sync -- --refetch    # ignore files already on disk
 */

type SourceDefinition = {
  examCode: string;
  label: string;
  url: string;
  format: "PDF" | "HTML";
  note?: string;
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const ROOT = "syllabus";
const definitions = JSON.parse(
  readFileSync(join(ROOT, "sources.json"), "utf8"),
) as SourceDefinition[];

const args = process.argv.slice(2);
const examFilter = args.find((arg) => arg.startsWith("--exam="))?.split("=")[1];
const refetch = args.includes("--refetch");

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
      .replace(/<\/(p|div|section|article|li|tr|h[1-6]|table|ul|ol)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  );
}

function cleanText(value: string): string {
  return value
    .replace(/\r/g, "")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatBytes(bytes: number): string {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

async function main() {
  const exams = await prisma.exam.findMany({
    where: { active: true },
    select: { id: true, code: true },
  });
  const examByCode = new Map(exams.map((exam) => [exam.code, exam]));

  const results: Array<{
    exam: string;
    label: string;
    status: "IMPORTED" | "FAILED" | "SKIPPED";
    chars?: number;
    file?: string;
    note?: string;
  }> = [];

  for (const definition of definitions) {
    if (examFilter && definition.examCode !== examFilter) continue;
    const exam = examByCode.get(definition.examCode);
    if (!exam) {
      results.push({
        exam: definition.examCode,
        label: definition.label,
        status: "FAILED",
        note: "exam code not found in the database",
      });
      continue;
    }

    const folder = join(ROOT, definition.examCode);
    mkdirSync(folder, { recursive: true });
    const extension = definition.format === "PDF" ? ".pdf" : ".html";
    const slug = slugify(definition.label) || basename(new URL(definition.url).pathname);
    const file = join(folder, `${slug}${extension}`);
    const textFile = join(folder, `${slug}.txt`);

    let raw: Buffer;
    try {
      if (!refetch && statSync(file, { throwIfNoEntry: false })) {
        raw = readFileSync(file);
      } else {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 90_000);
        const response = await fetch(definition.url, {
          headers: {
            "user-agent": UA,
            accept: "application/pdf,text/html;q=0.9,*/*;q=0.8",
          },
          signal: controller.signal,
          redirect: "follow",
        });
        clearTimeout(timer);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        raw = Buffer.from(await response.arrayBuffer());
        writeFileSync(file, raw);
      }
    } catch (error) {
      const message = String(error).slice(0, 300);
      await prisma.syllabusSource.upsert({
        where: { examId_url: { examId: exam.id, url: definition.url } },
        create: {
          examId: exam.id,
          label: definition.label,
          url: definition.url,
          kind: "SYLLABUS",
          format: definition.format,
          status: "FAILED",
          error: message,
          fetchedAt: new Date(),
        },
        update: {
          label: definition.label,
          format: definition.format,
          status: "FAILED",
          error: message,
          fetchedAt: new Date(),
        },
      });
      results.push({ exam: definition.examCode, label: definition.label, status: "FAILED", note: message });
      continue;
    }

    let text = "";
    try {
      if (definition.format === "PDF") {
        execFileSync("python", ["scripts/pdf_text.py", file, textFile], { stdio: "pipe" });
        text = readFileSync(textFile, "utf8");
      } else {
        text = htmlToText(raw.toString("utf8"));
        writeFileSync(textFile, text, "utf8");
      }
    } catch (error) {
      const message = `text extraction failed: ${String(error).slice(0, 250)}`;
      await prisma.syllabusSource.upsert({
        where: { examId_url: { examId: exam.id, url: definition.url } },
        create: {
          examId: exam.id,
          label: definition.label,
          url: definition.url,
          kind: "SYLLABUS",
          format: definition.format,
          status: "FAILED",
          error: message,
          fetchedAt: new Date(),
        },
        update: { status: "FAILED", error: message, fetchedAt: new Date() },
      });
      results.push({
        exam: definition.examCode,
        label: definition.label,
        status: "FAILED",
        file,
        note: message,
      });
      continue;
    }

    const cleaned = cleanText(text);
    if (cleaned.length < 200) {
      const message = `extracted only ${cleaned.length} characters; the document may be a scan or a navigation shell`;
      await prisma.syllabusSource.upsert({
        where: { examId_url: { examId: exam.id, url: definition.url } },
        create: {
          examId: exam.id,
          label: definition.label,
          url: definition.url,
          kind: "SYLLABUS",
          format: definition.format,
          status: "FAILED",
          error: message,
          fetchedAt: new Date(),
        },
        update: { status: "FAILED", error: message, fetchedAt: new Date() },
      });
      results.push({
        exam: definition.examCode,
        label: definition.label,
        status: "FAILED",
        file,
        chars: cleaned.length,
        note: message,
      });
      continue;
    }

    writeFileSync(textFile, cleaned, "utf8");
    const content = cleaned.length > 400_000 ? cleaned.slice(0, 400_000) : cleaned;

    await prisma.syllabusSource.upsert({
      where: { examId_url: { examId: exam.id, url: definition.url } },
      create: {
        examId: exam.id,
        label: definition.label,
        url: definition.url,
        kind: "SYLLABUS",
        format: definition.format,
        status: "IMPORTED",
        content,
        fetchedAt: new Date(),
      },
      update: {
        label: definition.label,
        format: definition.format,
        status: "IMPORTED",
        content,
        error: null,
        fetchedAt: new Date(),
      },
    });

    results.push({
      exam: definition.examCode,
      label: definition.label,
      status: "IMPORTED",
      chars: cleaned.length,
      file: `${file} (${formatBytes(raw.length)})`,
      note: definition.note,
    });
  }

  for (const row of results) {
    console.log(
      `${row.status.padEnd(8)} ${row.exam.padEnd(13)} ${String(row.chars ?? "").padStart(7)} chars  ${row.label}`,
    );
    if (row.file) console.log(`${"".padEnd(9)}${row.file}`);
    if (row.note) console.log(`${"".padEnd(9)}${row.note}`);
  }

  const totals = results.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});

  if (args.includes("--prune")) {
    const keep = new Set(definitions.map((definition) => definition.url));
    const stale = await prisma.syllabusSource.findMany({
      where: { kind: "SYLLABUS" },
      select: { id: true, url: true, label: true, exam: { select: { code: true } } },
    });
    const removed = stale.filter((row) => !keep.has(row.url));
    if (removed.length) {
      await prisma.syllabusSource.deleteMany({
        where: { id: { in: removed.map((row) => row.id) } },
      });
      console.log(`\nPruned ${removed.length} source(s) that are not in sources.json:`);
      for (const row of removed) console.log(`  - ${row.exam.code} ${row.label} ${row.url}`);
    }
  }

  console.log(`\nTotals: ${JSON.stringify(totals)}`);
  console.log(`Archive: ${process.cwd()}\\${ROOT}`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
