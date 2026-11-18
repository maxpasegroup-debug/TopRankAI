import { prisma } from "@/server/db";
import { getProSubscription } from "./pro";
import { type CandidateExam } from "./candidate";
import { addDays, formatDate, toNumber, todayDate } from "./utils";
import { notify } from "./notifications";
import { PRO_CUSTOM_TESTS_PER_DAY, CUSTOM_TEST_MAX_QUESTIONS, CUSTOM_TEST_MIN_QUESTIONS } from "@/shared/pro";

export type CustomDifficulty = "ANY" | "EASY" | "MEDIUM" | "HARD";

export type CustomTestInput = {
  subjectIds: string[];
  topicIds: string[];
  difficulty: CustomDifficulty;
  count: number;
  minutes: number;
};

export type CustomTestOptions = {
  subjects: { id: string; name: string; count: number }[];
  topics: { id: string; title: string; subject: string; count: number }[];
  difficulties: Record<Exclude<CustomDifficulty, "ANY">, number>;
  total: number;
  usedToday: number;
  remainingToday: number;
  maxQuestions: number;
};

const CUSTOM_SLOT_BASE = 1000;

function fingerprint(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ").replace(/[^\p{L}\p{N} ]+/gu, "");
}

function hashValue(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

type PoolRow = {
  questionId: string;
  marks: number;
  negativeMarks: number;
  subjectId: string;
  subjectName: string;
  topicId: string | null;
  topicTitle: string | null;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  text: string;
};

async function loadPool(examId: string, input?: Pick<CustomTestInput, "subjectIds" | "topicIds" | "difficulty">) {
  const rows = await prisma.questionExam.findMany({
    where: {
      examId,
      status: "PUBLISHED",
      active: true,
      question: {
        status: "PUBLISHED",
        active: true,
        reviewStatus: "REVIEWED",
        ...(input?.subjectIds.length ? { subjectId: { in: input.subjectIds } } : {}),
        ...(input && input.difficulty !== "ANY" ? { difficulty: input.difficulty } : {}),
        ...(input?.topicIds.length ? { topicId: { in: input.topicIds } } : {}),
      },
    },
    select: {
      questionId: true,
      marks: true,
      negativeMarks: true,
      question: {
        select: {
          text: true,
          difficulty: true,
          subjectId: true,
          topicId: true,
          subject: { select: { name: true } },
          topic: { select: { title: true } },
        },
      },
    },
  });
  const seen = new Set<string>();
  const pool: PoolRow[] = [];
  for (const row of rows) {
    const key = fingerprint(row.question.text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    pool.push({
      questionId: row.questionId,
      marks: toNumber(row.marks),
      negativeMarks: toNumber(row.negativeMarks),
      subjectId: row.question.subjectId,
      subjectName: row.question.subject.name,
      topicId: row.question.topicId,
      topicTitle: row.question.topic?.title ?? null,
      difficulty: row.question.difficulty,
      text: row.question.text,
    });
  }
  return pool;
}

export async function getCustomTestOptions(userId: string, exam: CandidateExam): Promise<CustomTestOptions> {
  const today = todayDate();
  const [pool, usedToday] = await Promise.all([
    loadPool(exam.examId),
    prisma.dailyExam.count({ where: { userId, examId: exam.examId, scheduledDate: today, slot: { gte: CUSTOM_SLOT_BASE } } }),
  ]);
  const subjectMap = new Map<string, { id: string; name: string; count: number }>();
  const topicMap = new Map<string, { id: string; title: string; subject: string; count: number }>();
  const difficulties = { EASY: 0, MEDIUM: 0, HARD: 0 };
  for (const row of pool) {
    const subject = subjectMap.get(row.subjectId) ?? { id: row.subjectId, name: row.subjectName, count: 0 };
    subject.count += 1;
    subjectMap.set(row.subjectId, subject);
    difficulties[row.difficulty] += 1;
    if (row.topicId && row.topicTitle) {
      const topic = topicMap.get(row.topicId) ?? { id: row.topicId, title: row.topicTitle, subject: row.subjectName, count: 0 };
      topic.count += 1;
      topicMap.set(row.topicId, topic);
    }
  }
  return {
    subjects: [...subjectMap.values()].sort((left, right) => right.count - left.count || left.name.localeCompare(right.name)),
    topics: [...topicMap.values()].sort((left, right) => right.count - left.count || left.title.localeCompare(right.title)),
    difficulties,
    total: pool.length,
    usedToday,
    remainingToday: Math.max(0, PRO_CUSTOM_TESTS_PER_DAY - usedToday),
    maxQuestions: Math.min(CUSTOM_TEST_MAX_QUESTIONS, pool.length),
  };
}

export async function createCustomTest(userId: string, exam: CandidateExam, input: CustomTestInput) {
  if (!(await getProSubscription(userId))) {
    throw new Error("Custom tests are part of Pro. Choose a plan in Subscriptions to build your own paper.");
  }
  const today = todayDate();
  const usedToday = await prisma.dailyExam.count({
    where: { userId, examId: exam.examId, scheduledDate: today, slot: { gte: CUSTOM_SLOT_BASE } },
  });
  if (usedToday >= PRO_CUSTOM_TESTS_PER_DAY) {
    throw new Error(`You have used today's ${PRO_CUSTOM_TESTS_PER_DAY} custom tests. Tomorrow's allowance resets at midnight IST.`);
  }

  const pool = await loadPool(exam.examId, input);
  if (!pool.length) {
    throw new Error("No reviewed questions match that filter yet. Try another subject or difficulty.");
  }
  const count = clamp(Math.floor(input.count), CUSTOM_TEST_MIN_QUESTIONS, Math.min(CUSTOM_TEST_MAX_QUESTIONS, pool.length));
  if (pool.length < 5) {
    throw new Error(`Only ${pool.length} reviewed question${pool.length === 1 ? "" : "s"} match that filter. A custom test needs at least 5.`);
  }

  const recentPapers = await prisma.dailyExam.findMany({
    where: { userId, examId: exam.examId, scheduledDate: { gte: addDays(today, -30) } },
    select: { questionIds: true },
  });
  const seen = new Set(recentPapers.flatMap((paper) => paper.questionIds));
  const seed = `${userId}:${exam.examId}:${today.toISOString()}:${usedToday}:${count}`;
  const ordered = [...pool].sort((left, right) => {
    const leftSeen = seen.has(left.questionId) ? 1 : 0;
    const rightSeen = seen.has(right.questionId) ? 1 : 0;
    if (leftSeen !== rightSeen) return leftSeen - rightSeen;
    return hashValue(`${seed}:${left.questionId}`) - hashValue(`${seed}:${right.questionId}`) || left.questionId.localeCompare(right.questionId);
  });
  const picks = ordered.slice(0, count).map((row) => ({
    questionId: row.questionId,
    section: row.subjectName,
    marks: row.marks > 0 ? row.marks : exam.positiveMarks,
    negativeMarks: row.negativeMarks > 0 ? row.negativeMarks : exam.negativeMarks,
    subject: row.subjectName,
    difficulty: row.difficulty,
  }));
  const totalMarks = picks.reduce((sum, item) => sum + item.marks, 0);
  const penaltyMarks = picks.reduce((sum, item) => sum + item.negativeMarks, 0);
  const minutes = clamp(Math.round(input.minutes), 5, 180);

  const maxSlot = await prisma.dailyExam.aggregate({
    where: { userId, examId: exam.examId, scheduledDate: today, slot: { gte: CUSTOM_SLOT_BASE } },
    _max: { slot: true },
  });
  const slot = Math.max(CUSTOM_SLOT_BASE - 1, maxSlot._max.slot ?? CUSTOM_SLOT_BASE - 1) + 1;

  const created = await prisma.dailyExam.create({
    data: {
      userId,
      examId: exam.examId,
      scheduledDate: today,
      slot,
      title: `${exam.shortName ?? exam.name} custom test ${usedToday + 1} · ${formatDate(today, { day: "numeric", month: "short" })}`,
      status: "SCHEDULED",
      questionIds: picks.map((item) => item.questionId),
      configSnapshot: {
        mode: "CUSTOM_TEST",
        officialTotal: picks.length,
        officialMarks: Math.round(totalMarks * 100) / 100,
        officialDurationMinutes: minutes,
        sectionCoverage: [],
        level: exam.level,
        durationMinutes: minutes,
        positiveMarks: exam.positiveMarks,
        negativeMarks: exam.negativeMarks,
        examCode: exam.code,
        partCode: exam.part?.code ?? null,
        partName: exam.part?.name ?? null,
        paper: picks,
        custom: {
          subjects: [...new Set(picks.map((item) => item.subject))],
          topics: input.topicIds,
          difficulty: input.difficulty,
          requested: input.count,
        },
      },
      durationMinutes: minutes,
      totalMarks,
      negativeMarks: penaltyMarks,
      aiGeneratedCount: 0,
    },
  });

  await notify(
    userId,
    "DAILY_EXAM",
    "Your custom test is ready",
    `${picks.length} questions from ${[...new Set(picks.map((item) => item.subject))].join(", ")} • ${minutes} minutes • ${formatDate(today)}.`,
    `/app/practice`,
  );

  return { id: created.id, count: picks.length, requested: input.count, minutes, totalMarks };
}

export async function listCustomTests(userId: string, examId: string) {
  return prisma.dailyExam.findMany({
    where: { userId, examId, slot: { gte: CUSTOM_SLOT_BASE } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 15,
    include: {
      attempt: { select: { id: true, status: true, obtainedMarks: true, totalMarks: true, accuracy: true, submittedAt: true } },
    },
  });
}
