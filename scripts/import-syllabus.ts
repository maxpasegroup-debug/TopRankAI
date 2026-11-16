/**
 * Official syllabus / previous-year-paper importer.
 *
 * Usage:
 *   npx tsx scripts/import-syllabus.ts                # all active exams
 *   npx tsx scripts/import-syllabus.ts --exam=CAT     # one exam
 *   npx tsx scripts/import-syllabus.ts --max=8        # links per exam
 *
 * The script never invents content. Every row stores the exact URL it came
 * from, plus a status of IMPORTED or FAILED. PDFs are transcribed by the
 * configured Gemini model; HTML is reduced to readable text. Human review is
 * still required before relying on a source.
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { databaseUrl } from "../src/server/env";
import { transcribePdf } from "../src/server/ai/pdf";
import { syllabusSourceSeeds } from "../prisma/platform-seed/syllabus-sources";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl() }) });

const args = process.argv.slice(2);
const onlyExam = args.find((arg) => arg.startsWith("--exam="))?.split("=")[1]?.toUpperCase();
const maxLinks = Math.max(1, Math.min(12, Number(args.find((arg) => arg.startsWith("--max="))?.split("=")[1] ?? 6)));

const LINK_KEYWORDS = /syllab|curricul|information bulletin|brochure|question paper|previous year|sample paper|paper pattern/i;
const SKIP_EXTENSIONS = /\.(css|js|png|jpe?g|gif|svg|webp|ico|zip|docx?|xlsx?)(\?|$)/i;
const USER_AGENT = "TopRankAI-SyllabusImporter/1.0 (+official syllabus reference capture)";

/** Content hashes already stored in this run, to reject the same page at many URLs. */
const seenContent = new Map<string, string>();

function decodeEntities(input: string) {
  const named: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ",
    ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”",
    hellip: "…", middot: "·", times: "×", divide: "÷",
  };
  return input
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => named[String(name).toLowerCase()] ?? match);
}

function sanitizeText(input: string) {
  return input
    .replace(/\u0000/g, "")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "")
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ");
}

function htmlToText(html: string) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

function resolveUrl(href: string, base: string) {
  try {
    const url = new URL(href, base);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function discoverLinks(html: string, baseUrl: string) {
  const links: { url: string; label: string }[] = [];
  const seen = new Set<string>();
  const pattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const href = match[1];
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("javascript:")) continue;
    if (SKIP_EXTENSIONS.test(href)) continue;
    const label = htmlToText(match[2]).replace(/\s+/g, " ").trim();
    if (!LINK_KEYWORDS.test(`${label} ${href}`)) continue;
    const resolved = resolveUrl(href, baseUrl);
    if (!resolved || seen.has(resolved) || resolved === baseUrl) continue;
    seen.add(resolved);
    links.push({ url: resolved, label: label || "Official document" });
    if (links.length >= maxLinks) break;
  }
  return links;
}

async function fetchBuffer(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/pdf,*/*" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { buffer: Buffer.from(await response.arrayBuffer()), contentType: response.headers.get("content-type") ?? "", finalUrl: response.url };
  } finally {
    clearTimeout(timeout);
  }
}

async function importDocument(input: {
  examId: string;
  examCode: string;
  label: string;
  url: string;
  html?: string;
}) {
  const report = { label: input.label, url: input.url, status: "IMPORTED" as "IMPORTED" | "FAILED", format: "HTML", chars: 0, error: undefined as string | undefined };
  try {
    const { buffer, contentType, finalUrl } = await fetchBuffer(input.url);
    const isPdf = contentType.includes("pdf") || buffer.subarray(0, 5).toString("latin1") === "%PDF-";
    let text: string;
    if (isPdf) {
      report.format = "PDF";
      const transcription = await transcribePdf({ buffer, label: `${input.examCode} · ${input.label}` });
      if (!transcription.ok) throw new Error(transcription.message);
      text = transcription.text;
    } else {
      const html = input.html ?? buffer.toString("utf8");
      text = htmlToText(html);
    }
    if (text.length < 300) throw new Error("Extracted text was too short to be a syllabus document.");
    text = sanitizeText(text).slice(0, 2_000_000);

    // Official sites often answer every path with the same navigation shell.
    // Reject that so the AI never treats menus as syllabus content.
    const lower = text.toLowerCase();
    const navigationSignals = ["skip to main content", "toggle navigation", "search form", "website policies", "sitemap"];
    if (navigationSignals.filter((signal) => lower.includes(signal)).length >= 2) {
      throw new Error("Extracted page is site navigation, not a syllabus document.");
    }
    const contentHash = createHash("sha256").update(text).digest("hex");
    const duplicateOf = seenContent.get(contentHash);
    if (duplicateOf && duplicateOf !== input.url) throw new Error(`Duplicate of ${duplicateOf}`);
    seenContent.set(contentHash, input.url);

    report.chars = text.length;
    await prisma.syllabusSource.upsert({
      where: { examId_url: { examId: input.examId, url: input.url } },
      update: {
        label: input.label,
        format: report.format,
        content: text,
        status: "IMPORTED",
        error: null,
        fetchedAt: new Date(),
      },
      create: {
        examId: input.examId,
        label: input.label,
        url: input.url,
        kind: "SYLLABUS",
        format: report.format,
        content: text,
        status: "IMPORTED",
        fetchedAt: new Date(),
      },
    });
    return { ...report, finalUrl };
  } catch (error) {
    report.status = "FAILED";
    report.error = error instanceof Error ? error.message.slice(0, 400) : String(error).slice(0, 400);
    await prisma.syllabusSource.upsert({
      where: { examId_url: { examId: input.examId, url: input.url } },
      update: { label: input.label, status: "FAILED", error: report.error, fetchedAt: new Date() },
      create: {
        examId: input.examId,
        label: input.label,
        url: input.url,
        kind: "SYLLABUS",
        status: "FAILED",
        error: report.error,
        fetchedAt: new Date(),
      },
    });
    return report;
  }
}

async function main() {
  const exams = await prisma.exam.findMany({
    where: { active: true, ...(onlyExam ? { code: onlyExam } : {}) },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, shortName: true, officialUrl: true },
  });
  if (!exams.length) {
    console.log(`No exams matched${onlyExam ? ` ${onlyExam}` : ""}.`);
    return;
  }

  const report: Record<string, unknown[]> = {};
  for (const exam of exams) {
    const rows: unknown[] = [];
    const seen = new Set<string>();
    const queue: { url: string; label: string }[] = [];

    for (const seed of syllabusSourceSeeds.filter((item) => item.examCode === exam.code)) {
      queue.push({ url: seed.url, label: seed.label });
    }
    if (exam.officialUrl) queue.push({ url: exam.officialUrl, label: `${exam.shortName ?? exam.name} official website` });

    console.log(`\n=== ${exam.code} (${exam.name}) ===`);
    let landingHtml: string | null = null;
    if (exam.officialUrl) {
      try {
        const page = await fetchBuffer(exam.officialUrl);
        const isPdf = page.contentType.includes("pdf") || page.buffer.subarray(0, 5).toString("latin1") === "%PDF-";
        if (!isPdf) landingHtml = page.buffer.toString("utf8");
      } catch {
        // The per-URL import below records the failure in the database.
      }
    }

    for (const item of queue) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      const result = await importDocument({ examId: exam.id, examCode: exam.code, ...item });
      rows.push(result);
      console.log(`  ${result.status.padEnd(8)} ${result.chars.toString().padStart(6)} chars  ${item.label}  ${item.url}${result.error ? `  [${result.error}]` : ""}`);
    }

    if (landingHtml) {
      for (const link of discoverLinks(landingHtml, exam.officialUrl ?? "")) {
        if (seen.has(link.url)) continue;
        seen.add(link.url);
        const result = await importDocument({ examId: exam.id, examCode: exam.code, url: link.url, label: link.label.slice(0, 180) });
        rows.push(result);
        console.log(`  ${result.status.padEnd(8)} ${result.chars.toString().padStart(6)} chars  ${link.label.slice(0, 70)}  ${link.url}${result.error ? `  [${result.error}]` : ""}`);
      }
    }

    report[exam.code] = rows;
  }

  const imported = Object.values(report).flat().filter((row) => (row as { status?: string }).status === "IMPORTED").length;
  const failed = Object.values(report).flat().filter((row) => (row as { status?: string }).status === "FAILED").length;
  console.log(`\nImported ${imported} source${imported === 1 ? "" : "s"}; ${failed} failed.`);
  console.log("Review every row in the admin console before treating it as official.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
