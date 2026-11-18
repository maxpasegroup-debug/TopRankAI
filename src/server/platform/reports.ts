import { prisma } from "@/server/db";
import { computeStreak, type CandidateExam } from "./candidate";
import { addDays, formatDate, localDateKey, percent, todayDate, toNumber } from "./utils";

type Breakdown = Record<string, { total: number; correct: number; incorrect: number; unanswered: number; marks: number }>;

type AttemptRow = {
  id: string;
  submittedAt: Date | null;
  accuracy: unknown;
  scorePercent: unknown;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  timeTakenSeconds: number;
  obtainedMarks: unknown;
  totalMarks: unknown;
  negativeMarks: unknown;
  subjectBreakdown: unknown;
  topicBreakdown: unknown;
  dailyExam: { id: string; title: string; scheduledDate: Date } | null;
};

export type WeekStats = {
  papers: number;
  questions: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  accuracy: number;
  marksObtained: number;
  marksTotal: number;
  studyMinutes: number;
  activeDays: number;
  bestScore: number;
  negativeMarks: number;
  averageTimePerQuestion: number;
};

export type WeeklyReport = {
  from: Date;
  to: Date;
  previousFrom: Date;
  previousTo: Date;
  current: WeekStats;
  previous: WeekStats;
  subjects: { name: string; total: number; correct: number; accuracy: number }[];
  weakTopics: { title: string; total: number; correct: number; accuracy: number }[];
  streak: number;
  papers: AttemptRow[];
  insight: string;
  delta: { accuracy: number; papers: number; marks: number };
};

function emptyStats(): WeekStats {
  return {
    papers: 0,
    questions: 0,
    correct: 0,
    incorrect: 0,
    unanswered: 0,
    accuracy: 0,
    marksObtained: 0,
    marksTotal: 0,
    studyMinutes: 0,
    activeDays: 0,
    bestScore: 0,
    negativeMarks: 0,
    averageTimePerQuestion: 0,
  };
}

function summarise(rows: AttemptRow[], days: string[]): WeekStats {
  const stats = emptyStats();
  const active = new Set<string>();
  let time = 0;
  for (const row of rows) {
    stats.papers += 1;
    stats.questions += row.correctCount + row.incorrectCount + row.unansweredCount;
    stats.correct += row.correctCount;
    stats.incorrect += row.incorrectCount;
    stats.unanswered += row.unansweredCount;
    stats.marksObtained += toNumber(row.obtainedMarks);
    stats.marksTotal += toNumber(row.totalMarks);
    stats.negativeMarks += toNumber(row.negativeMarks);
    stats.studyMinutes += Math.round(row.timeTakenSeconds / 60);
    time += row.timeTakenSeconds;
    stats.bestScore = Math.max(stats.bestScore, toNumber(row.scorePercent));
    if (row.submittedAt) {
      const key = localDateKey(row.submittedAt);
      if (days.includes(key)) active.add(key);
    }
  }
  const answered = stats.correct + stats.incorrect;
  stats.accuracy = answered ? Math.round((stats.correct / answered) * 1000) / 10 : 0;
  stats.activeDays = active.size;
  stats.averageTimePerQuestion = stats.questions ? Math.round(time / stats.questions) : 0;
  return stats;
}

export async function getWeeklyReport(userId: string, exam: CandidateExam): Promise<WeeklyReport> {
  const today = todayDate();
  const from = addDays(today, -6);
  const previousFrom = addDays(today, -13);
  const previousTo = addDays(today, -7);
  const thisDays = Array.from({ length: 7 }, (_, index) => localDateKey(addDays(from, index)));
  const previousDays = Array.from({ length: 7 }, (_, index) => localDateKey(addDays(previousFrom, index)));

  const [attempts, streak] = await Promise.all([
    prisma.examAttempt.findMany({
      where: { userId, examId: exam.examId, status: "SUBMITTED", submittedAt: { gte: addDays(previousFrom, -1) } },
      orderBy: { submittedAt: "desc" },
      take: 80,
      select: {
        id: true,
        submittedAt: true,
        accuracy: true,
        scorePercent: true,
        correctCount: true,
        incorrectCount: true,
        unansweredCount: true,
        timeTakenSeconds: true,
        obtainedMarks: true,
        totalMarks: true,
        negativeMarks: true,
        subjectBreakdown: true,
        topicBreakdown: true,
        dailyExam: { select: { id: true, title: true, scheduledDate: true } },
      },
    }),
    computeStreak(userId, exam.examId),
  ]);

  const currentRows = attempts.filter((row) => row.submittedAt && thisDays.includes(localDateKey(row.submittedAt)));
  const previousRows = attempts.filter((row) => row.submittedAt && previousDays.includes(localDateKey(row.submittedAt)));
  const current = summarise(currentRows, thisDays);
  const previous = summarise(previousRows, previousDays);

  const subjectMap = new Map<string, { total: number; correct: number }>();
  const topicMap = new Map<string, { total: number; correct: number }>();
  for (const row of currentRows) {
    for (const [name, entry] of Object.entries((row.subjectBreakdown as Breakdown) ?? {})) {
      const bucket = subjectMap.get(name) ?? { total: 0, correct: 0 };
      bucket.total += entry.correct + entry.incorrect;
      bucket.correct += entry.correct;
      subjectMap.set(name, bucket);
    }
    for (const [name, entry] of Object.entries((row.topicBreakdown as Breakdown) ?? {})) {
      const bucket = topicMap.get(name) ?? { total: 0, correct: 0 };
      bucket.total += entry.correct + entry.incorrect;
      bucket.correct += entry.correct;
      topicMap.set(name, bucket);
    }
  }
  const subjects = [...subjectMap.entries()]
    .map(([name, row]) => ({ name, ...row, accuracy: row.total ? Math.round((row.correct / row.total) * 1000) / 10 : 0 }))
    .sort((left, right) => right.total - left.total);
  const weakTopics = [...topicMap.entries()]
    .filter(([, row]) => row.total >= 2)
    .map(([title, row]) => ({ title, ...row, accuracy: Math.round((row.correct / row.total) * 1000) / 10 }))
    .sort((left, right) => left.accuracy - right.accuracy)
    .slice(0, 5);

  const delta = {
    accuracy: Math.round((current.accuracy - previous.accuracy) * 10) / 10,
    papers: current.papers - previous.papers,
    marks: Math.round((current.marksObtained - previous.marksObtained) * 100) / 100,
  };
  const weakest = subjects.filter((subject) => subject.total >= 2).sort((left, right) => left.accuracy - right.accuracy)[0];
  const insight = current.papers
    ? `${current.papers} paper${current.papers === 1 ? "" : "s"} and ${current.activeDays} active day${current.activeDays === 1 ? "" : "s"}. Accuracy ${delta.accuracy === 0 ? "held steady" : delta.accuracy > 0 ? `improved by ${delta.accuracy} points` : `fell by ${Math.abs(delta.accuracy)} points`} against the week before${weakest ? `, with ${weakest.name} still the weakest subject at ${weakest.accuracy}%` : ""}.`
    : "No paper was submitted this week. The report stays empty rather than showing estimated numbers.";

  return {
    from,
    to: today,
    previousFrom,
    previousTo,
    current,
    previous,
    subjects,
    weakTopics,
    streak,
    papers: currentRows,
    insight,
    delta,
  };
}

export type RevisionSheet = {
  mistakes: {
    id: string;
    attemptId: string;
    question: string;
    type: string;
    subject: string;
    topic: string;
    paper: string;
    date: Date | null;
    yourAnswer: string;
    correctAnswer: string;
    explanation: string | null;
    marksLost: number;
  }[];
  groups: { topic: string; count: number }[];
  formulas: { id: string; title: string; subject: string; chapter: string; formulas: string }[];
  marksLost: number;
  papers: number;
  windowDays: number;
};

export async function getRevisionSheet(userId: string, exam: CandidateExam, windowDays = 30): Promise<RevisionSheet> {
  const today = todayDate();
  const [answers, formulaRows] = await Promise.all([
    prisma.userAnswer.findMany({
      where: {
        status: "INCORRECT",
        attempt: { userId, examId: exam.examId, status: "SUBMITTED", submittedAt: { gte: addDays(today, -windowDays) } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 80,
      select: {
        id: true,
        selected: true,
        marksAwarded: true,
        createdAt: true,
        question: {
          select: {
            text: true,
            type: true,
            explanation: true,
            numericalAnswer: true,
            subject: { select: { name: true } },
            topic: { select: { title: true } },
            options: { where: { active: true }, orderBy: { order: "asc" }, select: { id: true, code: true, text: true, isCorrect: true } },
          },
        },
        attempt: {
          select: { id: true, dailyExam: { select: { title: true, scheduledDate: true } } },
        },
      },
    }),
    prisma.syllabusTopic.findMany({
      where: { active: true, formulas: { not: null }, chapter: { active: true, unit: { examId: exam.examId, active: true } } },
      orderBy: [{ chapterId: "asc" }, { order: "asc" }],
      take: 120,
      select: {
        id: true,
        title: true,
        formulas: true,
        chapter: { select: { title: true, unit: { select: { title: true, subject: { select: { name: true } } } } } },
      },
    }),
  ]);

  const mistakes = answers.map((answer) => {
    const question = answer.question;
    const selected = Array.isArray(answer.selected) ? answer.selected.map(String) : [];
    const yourAnswer = question.type === "NUMERICAL"
      ? selected[0] ?? "Not answered"
      : question.options.filter((option) => selected.includes(option.id)).map((option) => `${option.code}. ${option.text}`).join("; ") || "Not answered";
    const correctAnswer = question.type === "NUMERICAL"
      ? question.numericalAnswer ?? "—"
      : question.options.filter((option) => option.isCorrect).map((option) => `${option.code}. ${option.text}`).join("; ") || "—";
    return {
      id: answer.id,
      attemptId: answer.attempt.id,
      question: question.text,
      type: question.type,
      subject: question.subject.name,
      topic: question.topic?.title ?? question.subject.name,
      paper: answer.attempt.dailyExam?.title ?? "Daily paper",
      date: answer.attempt.dailyExam?.scheduledDate ?? answer.createdAt,
      yourAnswer,
      correctAnswer,
      explanation: question.explanation,
      marksLost: Math.abs(toNumber(answer.marksAwarded)),
    };
  });

  const groups = [...mistakes.reduce((map, item) => {
    map.set(item.topic, (map.get(item.topic) ?? 0) + 1);
    return map;
  }, new Map<string, number>()).entries()]
    .map(([topic, count]) => ({ topic, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);

  const formulas = formulaRows
    .filter((row) => (row.formulas ?? "").trim().length > 0)
    .map((row) => ({
      id: row.id,
      title: row.title,
      subject: row.chapter.unit.subject.name,
      chapter: row.chapter.title,
      formulas: row.formulas!.trim(),
    }));

  return {
    mistakes,
    groups,
    formulas,
    marksLost: Math.round(mistakes.reduce((sum, item) => sum + item.marksLost, 0) * 100) / 100,
    papers: new Set(mistakes.map((item) => item.attemptId)).size,
    windowDays,
  };
}

export function reportRangeLabel(report: WeeklyReport) {
  return `${formatDate(report.from, { day: "numeric", month: "short" })} – ${formatDate(report.to, { day: "numeric", month: "short", year: "numeric" })}`;
}

export function deltaLabel(value: number, unit = "pt") {
  if (!value) return "No change";
  return `${value > 0 ? "+" : ""}${value} ${unit}`;
}

export function reportPercent(value: number, total: number) {
  return percent(value, total);
}
