import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db";
import { generateExamFeedback, fallbackFeedback, type ExamFeedback } from "@/server/ai/tasks";
import { evaluateAchievements } from "./achievements";
import type { CandidateExam } from "./candidate";
import { notify } from "./notifications";
import { findExamPart, readExamPattern, type PatternPart } from "./patterns";
import { addDays, formatDate, percent, todayDate, toNumber } from "./utils";

const answerSchema = z.array(z.object({
  questionId: z.string().min(1).max(100),
  selected: z.array(z.string().max(120)).max(8).default([]),
  timeSpentSeconds: z.number().int().min(0).max(24 * 3600).default(0),
  flagged: z.boolean().default(false),
})).max(300);

type Breakdown = Record<string, { total: number; correct: number; incorrect: number; unanswered: number; marks: number }>;

export type PaperMode = "FULL_MOCK" | "PRACTICE_SET";

export type PaperMeta = {
  mode: PaperMode;
  officialTotal: number;
  officialMarks: number;
  officialDurationMinutes: number;
  sectionCoverage: { name: string; required: number; selected: number }[];
};

type PaperPlanQuestion = { questionId: string; section: string | null; marks: number; negativeMarks: number };

type PoolItem = { questionId: string; subjectCode: string | null; marks: number; negativeMarks: number };

type TopicRow = {
  id: string;
  title: string;
  description: string | null;
  chapter: { title: string; unit: { title: string; subjectId: string } };
};

const TOPIC_STOP_WORDS = new Set([
  "choose", "correct", "following", "which", "what", "find", "this", "that", "with", "from",
  "have", "were", "will", "would", "could", "should", "most", "closest", "means", "meaning",
  "question", "answer", "option", "options", "given", "below", "above", "about", "into",
]);

/** Small phrase map that turns common question wording into a syllabus title. */
const TOPIC_HINTS: { match: RegExp; titles: string[] }[] = [
  { match: /\bantonym/i, titles: ["antonym"] },
  { match: /\bsynonym|closest in meaning|nearest in meaning/i, titles: ["synonym"] },
  { match: /\bidiom/i, titles: ["idiom"] },
  { match: /\bverb|agreement|subject-verb/i, titles: ["agreement"] },
  { match: /\bpreposition/i, titles: ["preposition"] },
  { match: /\barticle\b/i, titles: ["article"] },
  { match: /\bseries|sequence/i, titles: ["series"] },
  { match: /\bcod(e|ed|ing)\b/i, titles: ["coding"] },
  { match: /\bconclusion|syllogism|statement/i, titles: ["conclusion", "syllogism"] },
  { match: /\bcompound interest/i, titles: ["compound interest"] },
  { match: /\bsimple interest/i, titles: ["simple interest"] },
  { match: /\binterest/i, titles: ["interest"] },
  { match: /\baverage/i, titles: ["average"] },
  { match: /\bratio|proportion/i, titles: ["ratio", "proportion"] },
  { match: /\bspeed|km\/h|metre|meter/i, titles: ["speed"] },
  { match: /\bpercent|%/i, titles: ["percentage"] },
  { match: /\bprofit|loss/i, titles: ["profit", "loss"] },
  { match: /\bdiscount/i, titles: ["discount"] },
  { match: /\bprobab/i, titles: ["probability"] },
  { match: /\btriangle/i, titles: ["triangle"] },
  { match: /\bcircle/i, titles: ["circle"] },
  { match: /\bvolume/i, titles: ["volume"] },
  { match: /\bequation/i, titles: ["equation"] },
  { match: /\bpipe|cistern/i, titles: ["pipe", "cistern"] },
  { match: /\bboat|stream/i, titles: ["boat", "stream"] },
  { match: /\barrange|seating/i, titles: ["arrangement"] },
  { match: /\bblood relation/i, titles: ["blood relation"] },
  { match: /\bwork rate|working together|finish a task|days? to (finish|complete)/i, titles: ["work"] },
  { match: /\brepo rate|monetary policy|reserve bank/i, titles: ["reserve bank", "monetary policy"] },
  { match: /\bconstituent assembly/i, titles: ["preamble", "parliament"] },
  { match: /\bright to life|fundamental right|constitution/i, titles: ["fundamental rights", "preamble"] },
  { match: /\bgreenhouse/i, titles: ["greenhouse"] },
];

function topicTokens(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !TOPIC_STOP_WORDS.has(word));
}

function scoreTopic(questionText: string, topic: TopicRow) {
  const lower = questionText.toLowerCase();
  const titleLower = topic.title.toLowerCase();
  const questionTokens = new Set(topicTokens(questionText));
  let score = 0;

  if (titleLower.length >= 4 && lower.includes(titleLower)) score += 8;
  for (const hint of TOPIC_HINTS) {
    if (hint.match.test(lower) && hint.titles.some((fragment) => titleLower.includes(fragment))) score += 10;
  }

  for (const token of topicTokens(topic.title)) {
    if (questionTokens.has(token)) {
      score += 3;
      continue;
    }
    for (const questionToken of questionTokens) {
      if (questionToken.length >= 5 && token.length >= 5 &&
        (questionToken.startsWith(token.slice(0, 5)) || token.startsWith(questionToken.slice(0, 5)))) {
        score += 1;
        break;
      }
    }
  }

  return score;
}

/**
 * Seeds and imported questions are not always linked to a syllabus topic. The
 * result page must still point a candidate at the syllabus behind a question,
 * so this picks the best-scoring topic in the same subject. It returns null
 * rather than inventing a link when nothing matches.
 */
function pickTopic(questionText: string, subjectId: string | null, index: Map<string, TopicRow[]>) {
  if (!subjectId) return null;
  const candidates = index.get(subjectId) ?? [];
  let best: TopicRow | null = null;
  let bestScore = 0;
  for (const topic of candidates) {
    const score = scoreTopic(questionText, topic);
    if (score > bestScore) {
      best = topic;
      bestScore = score;
    }
  }
  return bestScore >= 3 ? best : null;
}

async function loadTopicIndex(examId: string, subjectIds: string[]) {
  const index = new Map<string, TopicRow[]>();
  if (!subjectIds.length) return index;
  const rows = await prisma.syllabusTopic.findMany({
    where: { active: true, chapter: { unit: { examId, subjectId: { in: subjectIds } } } },
    orderBy: [{ order: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      description: true,
      chapter: { select: { title: true, unit: { select: { title: true, subjectId: true } } } },
    },
  });
  for (const row of rows) {
    const key = row.chapter.unit.subjectId;
    const list = index.get(key) ?? [];
    list.push(row);
    index.set(key, list);
  }
  return index;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Reads the mode/pattern facts stored with a paper, tolerating older rows. */
export function readPaperMeta(snapshot: unknown): PaperMeta | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const raw = snapshot as Record<string, unknown>;
  const mode = raw.mode === "FULL_MOCK" ? "FULL_MOCK" : raw.mode === "PRACTICE_SET" ? "PRACTICE_SET" : null;
  if (!mode) return null;
  const coverage = Array.isArray(raw.sectionCoverage)
    ? raw.sectionCoverage.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const row = entry as Record<string, unknown>;
        if (typeof row.name !== "string") return [];
        return [{ name: row.name, required: asNumber(row.required), selected: asNumber(row.selected) }];
      })
    : [];
  return {
    mode,
    officialTotal: asNumber(raw.officialTotal),
    officialMarks: asNumber(raw.officialMarks),
    officialDurationMinutes: asNumber(raw.officialDurationMinutes),
    sectionCoverage: coverage,
  };
}

function readPaperQuestions(snapshot: unknown): PaperPlanQuestion[] {
  if (!snapshot || typeof snapshot !== "object") return [];
  const raw = snapshot as Record<string, unknown>;
  if (!Array.isArray(raw.paper)) return [];
  return raw.paper.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    if (typeof row.questionId !== "string") return [];
    return [{
      questionId: row.questionId,
      section: typeof row.section === "string" ? row.section : null,
      marks: asNumber(row.marks),
      negativeMarks: asNumber(row.negativeMarks),
    }];
  });
}

/**
 * Practice papers stay substantial even when the reviewed bank cannot cover the
 * official count: half of the real paper (and never fewer than the configured
 * daily size), capped by what the bank actually holds.
 */
function practiceSize(officialTotal: number, dailyTestQuestions: number) {
  return Math.max(1, Math.min(officialTotal, Math.max(dailyTestQuestions, Math.ceil(officialTotal * 0.5))));
}

/**
 * Picks questions section by section. Section quotas are honoured while the
 * reviewed bank has matching subject questions; any shortfall is filled from
 * the remaining pool so the paper still reaches its target length. The returned
 * coverage is stored with the paper so the UI can state exactly how faithful
 * the paper is to the official blueprint.
 */
function selectPaperQuestions(pool: PoolItem[], part: PatternPart | null, target: number) {
  const used = new Set<string>();
  const picks: PaperPlanQuestion[] = [];
  const coverage: PaperMeta["sectionCoverage"] = [];
  const officialTotal = part ? Math.max(1, part.totalQuestions) : target;
  const scale = Math.min(1, target / officialTotal);

  if (part?.sections.length) {
    for (const section of part.sections) {
      if (picks.length >= target) break;
      const sectionTarget = scale >= 1 ? section.questionCount : Math.max(1, Math.round(section.questionCount * scale));
      const desired = Math.max(0, Math.min(sectionTarget, section.questionCount, target - picks.length));
      let taken = 0;
      for (const item of pool) {
        if (taken >= desired) break;
        if (used.has(item.questionId)) continue;
        if (section.subjectCode && item.subjectCode !== section.subjectCode) continue;
        used.add(item.questionId);
        picks.push({
          questionId: item.questionId,
          section: section.name,
          marks: section.marksPerQuestion > 0 ? section.marksPerQuestion : item.marks,
          negativeMarks: section.marksPerQuestion > 0 ? section.negativeMarks : item.negativeMarks,
        });
        taken += 1;
      }
      coverage.push({ name: section.name, required: section.questionCount, selected: taken });
    }
  }

  for (const item of pool) {
    if (picks.length >= target) break;
    if (used.has(item.questionId)) continue;
    used.add(item.questionId);
    picks.push({ questionId: item.questionId, section: null, marks: item.marks, negativeMarks: item.negativeMarks });
  }

  return { picks, coverage };
}

async function buildDailyPaper(input: {
  userId: string;
  exam: CandidateExam;
  part: PatternPart | null;
  pool: PoolItem[];
  today: Date;
}) {
  const { userId, exam, part, pool, today } = input;
  const officialTotal = Math.max(1, part?.totalQuestions ?? exam.totalQuestions);
  const officialDuration = Math.max(10, part?.durationMinutes ?? exam.durationMinutes);
  const isFullMock = pool.length >= officialTotal;
  const target = isFullMock ? officialTotal : Math.min(pool.length, practiceSize(officialTotal, exam.dailyTestQuestions));

  const recentPapers = await prisma.dailyExam.findMany({
    where: { userId, examId: exam.examId, scheduledDate: { gte: addDays(today, -10) } },
    select: { questionIds: true },
  });
  const recent = new Set(recentPapers.flatMap((paper) => paper.questionIds));
  const seed = hashValue(`${today.toISOString().slice(0, 10)}:${userId}:${exam.code}:${part?.code ?? "default"}`);
  const ordered = [...pool].sort((left, right) => {
    const leftSeen = recent.has(left.questionId) ? 1 : 0;
    const rightSeen = recent.has(right.questionId) ? 1 : 0;
    if (leftSeen !== rightSeen) return leftSeen - rightSeen;
    return hashValue(`${seed}:${left.questionId}`) - hashValue(`${seed}:${right.questionId}`) || left.questionId.localeCompare(right.questionId);
  });

  const { picks, coverage } = selectPaperQuestions(ordered, part, target);
  const mode: PaperMode = isFullMock ? "FULL_MOCK" : "PRACTICE_SET";
  const durationMinutes = isFullMock
    ? officialDuration
    : Math.max(10, Math.min(90, Math.round((officialDuration * picks.length) / officialTotal)));
  const marksTotal = picks.reduce((sum, item) => sum + item.marks, 0);
  const penaltyTotal = picks.reduce((sum, item) => sum + item.negativeMarks, 0);

  return {
    mode,
    picks,
    coverage,
    durationMinutes,
    marksTotal,
    penaltyTotal,
    meta: {
      mode,
      officialTotal,
      officialMarks: part?.totalMarks ?? marksTotal,
      officialDurationMinutes: officialDuration,
      sectionCoverage: coverage,
    } satisfies PaperMeta,
  };
}


function hashValue(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function addToBreakdown(bucket: Breakdown, key: string, status: "CORRECT" | "INCORRECT" | "UNANSWERED", marks: number) {
  const row = bucket[key] ?? { total: 0, correct: 0, incorrect: 0, unanswered: 0, marks: 0 };
  row.total += 1;
  row.marks += marks;
  if (status === "CORRECT") row.correct += 1;
  else if (status === "INCORRECT") row.incorrect += 1;
  else row.unanswered += 1;
  bucket[key] = row;
}

function numericEqual(selected: string, expected: string | null) {
  if (!expected) return false;
  const left = Number(selected.trim());
  const right = Number(expected.trim());
  if (Number.isFinite(left) && Number.isFinite(right)) return Math.abs(left - right) < 1e-6;
  return selected.trim().toLowerCase() === expected.trim().toLowerCase();
}

async function ensureGoals(userId: string, exam: CandidateExam, questionCount: number, revisionDue: number) {
  const today = todayDate();
  const goals = [
    { type: "QUESTIONS" as const, title: "Answer today's questions", target: Math.max(1, questionCount), order: 1 },
    { type: "REVISION" as const, title: "Clear due revision", target: Math.max(1, revisionDue), order: 2 },
    { type: "MINUTES" as const, title: `Study for ${exam.dailyMinutes} minutes`, target: exam.dailyMinutes, order: 3 },
  ];
  for (const goal of goals) {
    await prisma.dailyGoal.upsert({
      where: { userId_examId_goalDate_title: { userId, examId: exam.examId, goalDate: today, title: goal.title } },
      update: { target: goal.target },
      create: { userId, examId: exam.examId, goalDate: today, ...goal },
    });
  }
}

export async function ensureDailyExam(userId: string, exam: CandidateExam) {
  const today = todayDate();
  const existing = await prisma.dailyExam.findFirst({
    where: { userId, examId: exam.examId, scheduledDate: today, slot: 0 },
    include: { attempt: true },
  });

  const revisionDue = await prisma.revisionQueue.count({ where: { userId, status: "PENDING", dueDate: { lte: today } } });

  if (existing) {
    await ensureGoals(userId, exam, existing.questionIds.length || exam.dailyTestQuestions, revisionDue);
    return existing;
  }

  const pool = await prisma.questionExam.findMany({
    where: {
      examId: exam.examId,
      status: "PUBLISHED",
      active: true,
      question: { status: "PUBLISHED", active: true, reviewStatus: "REVIEWED" },
    },
    orderBy: { questionId: "asc" },
    select: {
      questionId: true,
      marks: true,
      negativeMarks: true,
      question: { select: { subject: { select: { code: true } } } },
    },
  });

  if (!pool.length) {
    throw new Error("The curated question bank for this exam is still being prepared. Please explore the learning centre in the meantime.");
  }

  const plan = await buildDailyPaper({
    userId,
    exam,
    part: exam.part,
    pool: pool.map((item) => ({
      questionId: item.questionId,
      subjectCode: item.question.subject.code,
      marks: toNumber(item.marks),
      negativeMarks: toNumber(item.negativeMarks),
    })),
    today,
  });

  if (!plan.picks.length) {
    throw new Error("Today's paper could not be assembled from the reviewed bank. Please retry.");
  }

  const missed = await prisma.dailyExam.updateMany({
    where: { userId, examId: exam.examId, scheduledDate: { lt: today }, status: { in: ["SCHEDULED", "IN_PROGRESS"] } },
    data: { status: "MISSED", missedAt: new Date() },
  });
  if (missed.count > 0) {
    await notify(userId, "MISSED_EXAM", "A previous daily exam was missed", `${missed.count} earlier daily exam${missed.count === 1 ? "" : "s"} expired without a submission. Start today's paper to keep the rhythm.`, "/app/daily");
  }

  const paperLabel = plan.mode === "FULL_MOCK" ? "full mock" : "practice set";

  try {
    const created = await prisma.dailyExam.create({
      data: {
        userId,
        examId: exam.examId,
        scheduledDate: today,
        slot: 0,
        title: `${exam.shortName ?? exam.name} ${paperLabel} · ${formatDate(today, { day: "numeric", month: "short" })}`,
        status: "SCHEDULED",
        questionIds: plan.picks.map((item) => item.questionId),
        configSnapshot: {
          ...plan.meta,
          level: exam.level,
          durationMinutes: plan.durationMinutes,
          positiveMarks: exam.positiveMarks,
          negativeMarks: exam.negativeMarks,
          examCode: exam.code,
          partCode: exam.part?.code ?? null,
          partName: exam.part?.name ?? null,
          paper: plan.picks,
        },
        durationMinutes: plan.durationMinutes,
        totalMarks: plan.marksTotal,
        negativeMarks: plan.penaltyTotal,
        aiGeneratedCount: 0,
      },
      include: { attempt: true },
    });
    await ensureGoals(userId, exam, plan.picks.length, revisionDue);
    const detail = plan.mode === "FULL_MOCK"
      ? `${plan.picks.length} questions • ${plan.durationMinutes} minutes • full official pattern`
      : `${plan.picks.length} of ${plan.meta.officialTotal} official questions • ${plan.durationMinutes} minutes • practice set from the reviewed bank`;
    await notify(userId, "DAILY_EXAM", plan.mode === "FULL_MOCK" ? "Today's full mock is ready" : "Today's practice set is ready", `${detail} • ${formatDate(today)}.`, "/app/daily");
    return created;
  } catch {
    // Concurrent request created today's paper first.
    const fallback = await prisma.dailyExam.findFirst({
      where: { userId, examId: exam.examId, scheduledDate: today, slot: 0 },
      include: { attempt: true },
    });
    if (!fallback) throw new Error("Could not prepare today's exam. Please retry.");
    await ensureGoals(userId, exam, fallback.questionIds.length || plan.picks.length, revisionDue);
    return fallback;
  }
}

export async function startDailyExam(userId: string, dailyExamId: string) {
  const dailyExam = await prisma.dailyExam.findFirst({
    where: { id: dailyExamId, userId },
    include: { attempt: true },
  });
  if (!dailyExam) throw new Error("Daily exam not found.");
  if (dailyExam.attempt?.status === "SUBMITTED") return dailyExam.attempt.id;
  if (dailyExam.attempt) return dailyExam.attempt.id;
  if (dailyExam.status === "MISSED" || dailyExam.status === "EXPIRED" || dailyExam.status === "SUBMITTED") {
    throw new Error("This daily exam is closed.");
  }
  if (dailyExam.scheduledDate.getTime() < todayDate().getTime()) {
    await prisma.dailyExam.update({ where: { id: dailyExam.id }, data: { status: "MISSED", missedAt: new Date() } });
    throw new Error("This daily exam belongs to a previous day and is now closed.");
  }

  const attempt = await prisma.examAttempt.create({
    data: {
      dailyExamId: dailyExam.id,
      userId,
      examId: dailyExam.examId,
      status: "IN_PROGRESS",
      deadline: new Date(Date.now() + dailyExam.durationMinutes * 60_000),
    },
  });
  await prisma.dailyExam.update({ where: { id: dailyExam.id }, data: { status: "IN_PROGRESS", startedAt: new Date() } });
  return attempt.id;
}

export async function getAttemptPaper(userId: string, dailyExamId: string) {
  const dailyExam = await prisma.dailyExam.findFirst({
    where: { id: dailyExamId, userId },
    include: { attempt: true, exam: { select: { code: true, name: true } } },
  });
  if (!dailyExam) throw new Error("Daily exam not found.");
  const meta = readPaperMeta(dailyExam.configSnapshot);
  if (!dailyExam.attempt) return { state: "NOT_STARTED" as const, dailyExam, meta };
  if (dailyExam.attempt.status === "SUBMITTED") return { state: "SUBMITTED" as const, attemptId: dailyExam.attempt.id, dailyExam, meta };
  if (dailyExam.attempt.deadline.getTime() <= Date.now()) {
    await submitDailyExam(userId, dailyExam.attempt.id, []);
    return { state: "SUBMITTED" as const, attemptId: dailyExam.attempt.id, dailyExam, meta };
  }

  const questions = await prisma.question.findMany({
    where: { id: { in: dailyExam.questionIds } },
    include: {
      subject: { select: { name: true } },
      topic: { select: { title: true } },
      options: { where: { active: true }, orderBy: { order: "asc" }, select: { id: true, code: true, text: true } },
    },
  });
  const byId = new Map(questions.map((question) => [question.id, question]));
  const paper = dailyExam.questionIds.flatMap((id, index) => {
    const question = byId.get(id);
    if (!question) return [];
    return [{
      position: index + 1,
      id: question.id,
      text: question.text,
      type: question.type,
      difficulty: question.difficulty,
      subject: question.subject.name,
      topic: question.topic?.title ?? null,
      options: question.type === "NUMERICAL" ? [] : question.options,
    }];
  });

  return {
    state: "IN_PROGRESS" as const,
    dailyExam,
    attempt: dailyExam.attempt,
    paper,
    meta,
    remainingSeconds: Math.max(0, Math.floor((dailyExam.attempt.deadline.getTime() - Date.now()) / 1000)),
  };
}

export async function submitDailyExam(userId: string, attemptId: string, rawAnswers: unknown) {
  const answers = answerSchema.parse(rawAnswers);
  const attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId, userId },
    include: { dailyExam: true, exam: { select: { name: true, code: true } } },
  });
  if (!attempt) throw new Error("Attempt not found.");
  if (attempt.status === "SUBMITTED") return { attemptId, alreadySubmitted: true };

  const [questions, links] = await Promise.all([
    prisma.question.findMany({
      where: { id: { in: attempt.dailyExam.questionIds } },
      include: {
        options: { where: { active: true }, orderBy: { order: "asc" } },
        subject: { select: { id: true, name: true } },
        topic: { select: { id: true, title: true } },
      },
    }),
    prisma.questionExam.findMany({
      where: { examId: attempt.examId, questionId: { in: attempt.dailyExam.questionIds } },
      select: { questionId: true, marks: true, negativeMarks: true },
    }),
  ]);
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const linkById = new Map(links.map((link) => [link.questionId, link]));
  const answerByQuestion = new Map(answers.map((answer) => [answer.questionId, answer]));
  const snapshotPaper = new Map(readPaperQuestions(attempt.dailyExam.configSnapshot).map((item) => [item.questionId, item]));
  const topicIndex = await loadTopicIndex(attempt.examId, [...new Set(questions.map((question) => question.subject.id))]);

  let totalMarks = 0;
  let obtainedMarks = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;
  let negativeMarks = 0;
  const subjectBreakdown: Breakdown = {};
  const topicBreakdown: Breakdown = {};
  const answerRows: Prisma.UserAnswerCreateManyInput[] = [];
  const revisionItems: { questionId: string; topicId: string | null }[] = [];

  attempt.dailyExam.questionIds.forEach((questionId, index) => {
    const question = questionById.get(questionId);
    if (!question) return;
    const link = linkById.get(questionId);
    const snapshotQuestion = snapshotPaper.get(questionId);
    const resolvedTopic = question.topic ?? pickTopic(question.text, question.subject.id, topicIndex);
    const marks = snapshotQuestion?.marks && snapshotQuestion.marks > 0
      ? snapshotQuestion.marks
      : toNumber(link?.marks ?? 4);
    const penalty = snapshotQuestion
      ? snapshotQuestion.negativeMarks
      : toNumber(link?.negativeMarks ?? 1);
    totalMarks += marks;
    const submitted = answerByQuestion.get(questionId);
    const selected = submitted?.selected ?? [];
    const correctOptions = question.options.filter((option) => option.isCorrect);
    let status: "CORRECT" | "INCORRECT" | "UNANSWERED" = "UNANSWERED";
    let awarded = 0;

    if (!selected.length) {
      status = "UNANSWERED";
    } else if (question.type === "NUMERICAL") {
      status = numericEqual(selected[0], question.numericalAnswer) ? "CORRECT" : "INCORRECT";
    } else {
      const selectedSet = new Set(selected);
      const correctSet = new Set(correctOptions.map((option) => option.id));
      const same = selectedSet.size === correctSet.size && [...selectedSet].every((id) => correctSet.has(id));
      status = same ? "CORRECT" : "INCORRECT";
    }

    if (status === "CORRECT") {
      awarded = marks;
      correctCount += 1;
    } else if (status === "INCORRECT") {
      awarded = -penalty;
      incorrectCount += 1;
      negativeMarks += penalty;
      revisionItems.push({ questionId, topicId: resolvedTopic?.id ?? null });
    } else {
      unansweredCount += 1;
    }
    obtainedMarks += awarded;
    const subjectKey = question.subject.name;
    addToBreakdown(subjectBreakdown, subjectKey, status, awarded);
    addToBreakdown(topicBreakdown, resolvedTopic?.title ?? "Unmapped topic", status, awarded);

    answerRows.push({
      attemptId,
      questionId,
      position: index + 1,
      selected,
      status,
      marksAwarded: awarded,
      timeSpentSeconds: submitted?.timeSpentSeconds ?? 0,
      flagged: submitted?.flagged ?? false,
    });
  });

  const answered = correctCount + incorrectCount;
  const accuracy = answered ? Math.round((correctCount / answered) * 10000) / 100 : 0;
  const scorePercent = totalMarks ? Math.round((Math.max(0, obtainedMarks) / totalMarks) * 10000) / 100 : 0;
  const timeTakenSeconds = Math.max(0, Math.min(
    Math.floor((Date.now() - attempt.startedAt.getTime()) / 1000),
    attempt.dailyExam.durationMinutes * 60,
  ));
  const recordDate = attempt.dailyExam.scheduledDate;

  await prisma.$transaction(async (tx) => {
    await tx.userAnswer.deleteMany({ where: { attemptId } });
    if (answerRows.length) await tx.userAnswer.createMany({ data: answerRows });
    await tx.examAttempt.update({
      where: { id: attemptId },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        timeTakenSeconds,
        totalMarks,
        obtainedMarks,
        correctCount,
        incorrectCount,
        unansweredCount,
        negativeMarks,
        accuracy,
        scorePercent,
        subjectBreakdown: subjectBreakdown as Prisma.InputJsonValue,
        topicBreakdown: topicBreakdown as Prisma.InputJsonValue,
      },
    });
    await tx.dailyExam.update({
      where: { id: attempt.dailyExamId },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    });

    for (const item of revisionItems) {
      const existing = await tx.revisionQueue.findFirst({
        where: { userId, questionId: item.questionId, status: "PENDING" },
        select: { id: true },
      });
      if (!existing) {
        await tx.revisionQueue.create({
          data: {
            userId,
            examId: attempt.examId,
            questionId: item.questionId,
            topicId: item.topicId,
            reason: "Incorrect in a daily exam",
            dueDate: addDays(recordDate, correctCount >= incorrectCount ? 2 : 1),
          },
        });
      }
    }

    await tx.performanceRecord.upsert({
      where: { userId_examId_recordDate: { userId, examId: attempt.examId, recordDate } },
      create: {
        userId,
        examId: attempt.examId,
        recordDate,
        testsAttended: 1,
        totalQuestions: attemptsTotal(attempt.dailyExam.questionIds.length),
        correct: correctCount,
        incorrect: incorrectCount,
        unanswered: unansweredCount,
        marksObtained: obtainedMarks,
        marksTotal: totalMarks,
        accuracy,
        studyMinutes: Math.round(timeTakenSeconds / 60),
      },
      update: {
        testsAttended: { increment: 1 },
        totalQuestions: { increment: attempt.dailyExam.questionIds.length },
        correct: { increment: correctCount },
        incorrect: { increment: incorrectCount },
        unanswered: { increment: unansweredCount },
        marksObtained: { increment: obtainedMarks },
        marksTotal: { increment: totalMarks },
        studyMinutes: { increment: Math.round(timeTakenSeconds / 60) },
      },
    });
    const record = await tx.performanceRecord.findUnique({
      where: { userId_examId_recordDate: { userId, examId: attempt.examId, recordDate } },
    });
    if (record) {
      const recordAnswered = record.correct + record.incorrect;
      await tx.performanceRecord.update({
        where: { id: record.id },
        data: { accuracy: recordAnswered ? Math.round((record.correct / recordAnswered) * 10000) / 100 : 0 },
      });
    }

    const goals = await tx.dailyGoal.findMany({ where: { userId, examId: attempt.examId, goalDate: recordDate } });
    for (const goal of goals) {
      const increment = goal.type === "QUESTIONS"
        ? answered + unansweredCount
        : goal.type === "REVISION"
          ? revisionItems.length
          : goal.type === "MINUTES"
            ? Math.round(timeTakenSeconds / 60)
            : 0;
      if (!increment) continue;
      const progress = Math.min(goal.target, goal.progress + increment);
      await tx.dailyGoal.update({
        where: { id: goal.id },
        data: { progress, completedAt: goal.completedAt ?? (progress >= goal.target ? new Date() : null) },
      });
    }
  }, { timeout: 60_000 });

  const weakestSubjects = Object.entries(subjectBreakdown)
    .filter(([, row]) => row.incorrect > 0)
    .map(([name, row]) => ({ name, accuracy: row.correct + row.incorrect ? (row.correct / (row.correct + row.incorrect)) * 100 : 0 }))
    .sort((left, right) => left.accuracy - right.accuracy)
    .slice(0, 3);
  const weakestTopics = Object.entries(topicBreakdown)
    .filter(([, row]) => row.incorrect > 0)
    .map(([title, row]) => ({ title, accuracy: row.correct + row.incorrect ? (row.correct / (row.correct + row.incorrect)) * 100 : 0 }))
    .sort((left, right) => left.accuracy - right.accuracy)
    .slice(0, 3);

  const feedbackInput = {
    examName: attempt.exam.name,
    level: attempt.dailyExam.configSnapshot && typeof attempt.dailyExam.configSnapshot === "object" && "level" in attempt.dailyExam.configSnapshot
      ? String((attempt.dailyExam.configSnapshot as Record<string, unknown>).level)
      : "INTERMEDIATE",
    totalQuestions: attempt.dailyExam.questionIds.length,
    correct: correctCount,
    incorrect: incorrectCount,
    unanswered: unansweredCount,
    accuracy,
    scorePercent,
    timeTakenSeconds,
    durationMinutes: attempt.dailyExam.durationMinutes,
    weakestSubjects,
    weakestTopics,
    userId,
    examId: attempt.examId,
  };
  // Feedback is a bonus layer: a slow or failed AI call must never break the
  // submission that has already been scored and stored.
  let feedback: ExamFeedback;
  let aiGenerated = false;
  try {
    const result = await generateExamFeedback(feedbackInput);
    feedback = result.feedback;
    aiGenerated = result.aiGenerated;
  } catch {
    feedback = fallbackFeedback(feedbackInput);
    aiGenerated = false;
  }
  try {
    await prisma.examAttempt.update({
      where: { id: attemptId },
      data: { aiFeedback: { ...feedback, source: aiGenerated ? "AI" : "DETERMINISTIC" } as unknown as Prisma.InputJsonValue },
    });
  } catch {
    // The score is already committed; feedback can be regenerated on view.
  }

  await evaluateAchievements(userId);
  if (scorePercent === 100) {
    await notify(userId, "PERFORMANCE", "Full marks", `You scored ${obtainedMarks}/${totalMarks} on today's ${attempt.exam.name} paper.`, `/app/daily/${attempt.dailyExamId}/result`);
  } else if (accuracy >= 80) {
    await notify(userId, "PERFORMANCE", "Strong accuracy", `You answered ${correctCount} of ${attempt.dailyExam.questionIds.length} correctly (${accuracy.toFixed(0)}%).`, `/app/daily/${attempt.dailyExamId}/result`);
  }

  return { attemptId, alreadySubmitted: false, accuracy, scorePercent, correctCount, incorrectCount, unansweredCount };
}

function attemptsTotal(count: number) {
  return count;
}

export async function getAttemptResult(userId: string, attemptId: string) {
  const attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId, userId },
    include: {
      exam: { select: { name: true, code: true, officialUrl: true } },
      dailyExam: { select: { id: true, title: true, scheduledDate: true, durationMinutes: true, configSnapshot: true, questionIds: true } },
      answers: { orderBy: { position: "asc" } },
    },
  });
  if (!attempt) throw new Error("Result not found.");
  if (attempt.status !== "SUBMITTED") throw new Error("This attempt has not been submitted yet.");

  const questions = await prisma.question.findMany({
    where: { id: { in: attempt.answers.map((answer) => answer.questionId) } },
    include: {
      subject: { select: { id: true, name: true } },
      topic: {
        select: {
          id: true,
          title: true,
          chapter: { select: { title: true, unit: { select: { title: true } } } },
        },
      },
      options: { where: { active: true }, orderBy: { order: "asc" } },
    },
  });
  const byId = new Map(questions.map((question) => [question.id, question]));
  const snapshotPaper = new Map(readPaperQuestions(attempt.dailyExam.configSnapshot).map((item) => [item.questionId, item]));
  const topicIndex = await loadTopicIndex(attempt.examId, [...new Set(questions.map((question) => question.subject.id))]);
  const review = attempt.answers.flatMap((answer) => {
    const question = byId.get(answer.questionId);
    if (!question) return [];
    const topic = question.topic ?? pickTopic(question.text, question.subject.id, topicIndex);
    return [{
      id: question.id,
      position: answer.position,
      text: question.text,
      type: question.type,
      subject: question.subject.name,
      topic: topic
        ? {
            id: topic.id,
            title: topic.title,
            chapter: topic.chapter.title,
            unit: topic.chapter.unit.title,
            href: `/app/learn/${topic.id}`,
            inferred: !question.topic,
          }
        : null,
      section: snapshotPaper.get(question.id)?.section ?? null,
      explanation: question.explanation,
      numericalAnswer: question.numericalAnswer,
      status: answer.status,
      marksAwarded: toNumber(answer.marksAwarded),
      selected: Array.isArray(answer.selected) ? answer.selected.map(String) : [],
      options: question.options.map((option) => ({ id: option.id, code: option.code, text: option.text, isCorrect: option.isCorrect })),
      timeSpentSeconds: answer.timeSpentSeconds,
      flagged: answer.flagged,
    }];
  });

  const feedback = attempt.aiFeedback as unknown as (ExamFeedback & { source?: "AI" | "DETERMINISTIC" }) | null;
  const subjectBreakdown = attempt.subjectBreakdown as unknown as Breakdown;
  const displayTopicBreakdown: Breakdown = {};
  for (const item of review) {
    addToBreakdown(displayTopicBreakdown, item.topic?.title ?? `${item.subject} revision`, item.status, item.marksAwarded);
  }
  const weakSubjects = Object.entries(subjectBreakdown)
    .filter(([, row]) => row.incorrect > 0)
    .map(([name, row]) => ({ name, accuracy: row.correct + row.incorrect ? (row.correct / (row.correct + row.incorrect)) * 100 : 0 }))
    .sort((left, right) => left.accuracy - right.accuracy)
    .slice(0, 3);
  const weakTopics = Object.entries(displayTopicBreakdown)
    .filter(([, row]) => row.incorrect > 0)
    .map(([title, row]) => ({ title, accuracy: (row.correct / (row.correct + row.incorrect)) * 100 }))
    .sort((left, right) => left.accuracy - right.accuracy)
    .slice(0, 3);
  const shownFeedback = feedback?.source === "AI"
    ? feedback
    : {
        ...fallbackFeedback({
          examName: attempt.exam.name,
          level: attempt.dailyExam.configSnapshot && typeof attempt.dailyExam.configSnapshot === "object" && "level" in attempt.dailyExam.configSnapshot
            ? String((attempt.dailyExam.configSnapshot as Record<string, unknown>).level)
            : "INTERMEDIATE",
          totalQuestions: attempt.dailyExam.questionIds.length,
          correct: attempt.correctCount,
          incorrect: attempt.incorrectCount,
          unanswered: attempt.unansweredCount,
          accuracy: toNumber(attempt.accuracy),
          scorePercent: toNumber(attempt.scorePercent),
          timeTakenSeconds: attempt.timeTakenSeconds,
          durationMinutes: attempt.dailyExam.durationMinutes,
          weakestSubjects: weakSubjects,
          weakestTopics: weakTopics,
          userId,
          examId: attempt.examId,
        }),
        source: "DETERMINISTIC" as const,
      };

  return {
    attempt: {
      id: attempt.id,
      examName: attempt.exam.name,
      examCode: attempt.exam.code,
      officialUrl: attempt.exam.officialUrl,
      title: attempt.dailyExam.title,
      scheduledDate: attempt.dailyExam.scheduledDate,
      submittedAt: attempt.submittedAt,
      timeTakenSeconds: attempt.timeTakenSeconds,
      durationMinutes: attempt.dailyExam.durationMinutes,
      totalMarks: toNumber(attempt.totalMarks),
      obtainedMarks: toNumber(attempt.obtainedMarks),
      accuracy: toNumber(attempt.accuracy),
      scorePercent: toNumber(attempt.scorePercent),
      correctCount: attempt.correctCount,
      incorrectCount: attempt.incorrectCount,
      unansweredCount: attempt.unansweredCount,
      negativeMarks: toNumber(attempt.negativeMarks),
      aiFeedback: shownFeedback,
      feedbackSource: feedback?.source === "AI" ? "AI" : "DETERMINISTIC",
    },
    review,
    paperMeta: readPaperMeta(attempt.dailyExam.configSnapshot),
    subjectBreakdown: Object.entries(subjectBreakdown).map(([name, row]) => ({ name, ...row })),
    topicBreakdown: Object.entries(displayTopicBreakdown)
      .map(([title, row]) => ({ title, ...row }))
      .sort((left, right) => right.total - left.total)
      .slice(0, 8),
    scoreLine: `${toNumber(attempt.obtainedMarks)} / ${toNumber(attempt.totalMarks)}`,
    accuracyLine: `${toNumber(attempt.accuracy).toFixed(1)}%`,
    scorePercent: percent(toNumber(attempt.obtainedMarks), toNumber(attempt.totalMarks)),
  };
}

export async function getDailyHistory(userId: string, examId: string) {
  return prisma.dailyExam.findMany({
    where: { userId, examId },
    orderBy: [{ scheduledDate: "desc" }, { slot: "asc" }],
    take: 30,
    include: { attempt: { select: { id: true, status: true, accuracy: true, obtainedMarks: true, totalMarks: true, submittedAt: true } } },
  });
}
