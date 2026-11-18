import { prisma } from "@/server/db";
import { fallbackPlan, type StudyPlanSuggestion } from "@/server/ai/tasks";
import { computeStreak, getSyllabusCompletion, type CandidateExam } from "./candidate";
import { loadTopicIndex, pickTopic } from "./daily-exam";
import { addDays, daysBetween, localDateKey, percent, toNumber, todayDate } from "./utils";

type Breakdown = Record<string, { total: number; correct: number; incorrect: number; unanswered: number; marks: number }>;

export type ReadinessComponent = { key: string; label: string; value: number; detail: string };

export async function getReadiness(userId: string, exam: CandidateExam) {
  const today = todayDate();
  const [attempts, streak, syllabus] = await Promise.all([
    prisma.examAttempt.findMany({
      where: { userId, examId: exam.examId, status: "SUBMITTED" },
      orderBy: { submittedAt: "desc" },
      take: 60,
      select: { submittedAt: true, correctCount: true, incorrectCount: true, unansweredCount: true, accuracy: true },
    }),
    computeStreak(userId, exam.examId),
    getSyllabusCompletion(userId, exam.examId),
  ]);
  const last14 = attempts.filter((attempt) => attempt.submittedAt && daysBetween(attempt.submittedAt, new Date()) <= 14);
  const correct = attempts.reduce((sum, attempt) => sum + attempt.correctCount, 0);
  const incorrect = attempts.reduce((sum, attempt) => sum + attempt.incorrectCount, 0);
  const answered = correct + incorrect;
  const accuracy = answered ? (correct / answered) * 100 : 0;

  const daysAttended = new Set(last14.flatMap((attempt) => attempt.submittedAt ? [localDateKey(attempt.submittedAt)] : [])).size;
  const attendance = Math.min(1, daysAttended / 10) * 20;
  const accuracyScore = (accuracy / 100) * 35;
  const volume = Math.min(1, answered / 200) * 15;
  const syllabusScore = (syllabus.percent / 100) * 20;
  const consistency = Math.min(1, streak / 14) * 10;
  const total = Math.round(attendance + accuracyScore + volume + syllabusScore + consistency);

  const components: ReadinessComponent[] = [
    { key: "attendance", label: "Daily attendance", value: Math.round(attendance), detail: `${daysAttended} of the last 14 days have a completed paper.` },
    { key: "accuracy", label: "Answer accuracy", value: Math.round(accuracyScore), detail: `${accuracy.toFixed(1)}% accuracy across ${attempts.length} submitted papers.` },
    { key: "volume", label: "Question volume", value: Math.round(volume), detail: `${answered} questions answered so far.` },
    { key: "syllabus", label: "Syllabus coverage", value: Math.round(syllabusScore), detail: `${syllabus.completed} of ${syllabus.total} topics marked complete.` },
    { key: "consistency", label: "Study streak", value: Math.round(consistency), detail: `${streak}-day current streak.` },
  ];

  return { score: Math.min(100, total), components, accuracy, answered, streak, syllabus };
}

export async function getAnalytics(userId: string, exam: CandidateExam) {
  const [attempts, records, readiness, totalQuestions, totalAttempts] = await Promise.all([
    prisma.examAttempt.findMany({
      where: { userId, examId: exam.examId, status: "SUBMITTED" },
      orderBy: { submittedAt: "desc" },
      take: 40,
      select: {
        id: true, submittedAt: true, accuracy: true, scorePercent: true, correctCount: true, incorrectCount: true,
        unansweredCount: true, timeTakenSeconds: true, negativeMarks: true, subjectBreakdown: true, topicBreakdown: true,
        dailyExam: { select: { id: true, title: true, scheduledDate: true } },
      },
    }),
    prisma.performanceRecord.findMany({ where: { userId, examId: exam.examId }, orderBy: { recordDate: "desc" }, take: 30 }),
    getReadiness(userId, exam),
    prisma.questionExam.count({ where: { examId: exam.examId, status: "PUBLISHED", active: true, question: { status: "PUBLISHED", active: true } } }),
    prisma.examAttempt.count({ where: { userId, examId: exam.examId, status: "SUBMITTED" } }),
  ]);

  const subjectAggregate = new Map<string, { total: number; correct: number; incorrect: number }>();
  const topicAggregate = new Map<string, { total: number; correct: number; incorrect: number }>();
  for (const attempt of attempts) {
    const subjects = attempt.subjectBreakdown as unknown as Breakdown;
    for (const [name, row] of Object.entries(subjects ?? {})) {
      const current = subjectAggregate.get(name) ?? { total: 0, correct: 0, incorrect: 0 };
      current.total += row.total;
      current.correct += row.correct;
      current.incorrect += row.incorrect;
      subjectAggregate.set(name, current);
    }
    const topics = attempt.topicBreakdown as unknown as Breakdown;
    for (const [name, row] of Object.entries(topics ?? {})) {
      const current = topicAggregate.get(name) ?? { total: 0, correct: 0, incorrect: 0 };
      current.total += row.total;
      current.correct += row.correct;
      current.incorrect += row.incorrect;
      topicAggregate.set(name, current);
    }
  }

  const subjects = [...subjectAggregate.entries()]
    .map(([name, row]) => ({ name, ...row, accuracy: row.correct + row.incorrect ? (row.correct / (row.correct + row.incorrect)) * 100 : 0 }))
    .sort((left, right) => right.total - left.total);
  const weakTopics = [...topicAggregate.entries()]
    .filter(([, row]) => row.correct + row.incorrect >= 2)
    .map(([title, row]) => ({ title, ...row, accuracy: (row.correct / (row.correct + row.incorrect)) * 100 }))
    .sort((left, right) => left.accuracy - right.accuracy)
    .slice(0, 8);

  const negativeMarksLost = attempts.reduce((sum, attempt) => sum + toNumber(attempt.negativeMarks), 0);
  const totalAnswered = attempts.reduce((sum, attempt) => sum + attempt.correctCount + attempt.incorrectCount + attempt.unansweredCount, 0);
  const totalTime = attempts.reduce((sum, attempt) => sum + attempt.timeTakenSeconds, 0);
  const averageTimePerQuestion = totalAnswered ? Math.round(totalTime / totalAnswered) : 0;

  // Momentum compares the newest five papers with the five before them. It is
  // only shown for a subject that has answered questions in both windows.
  const recent = attempts.slice(0, 5);
  const earlier = attempts.slice(5, 10);
  const momentum = new Map<string, { recentCorrect: number; recentTotal: number; earlierCorrect: number; earlierTotal: number }>();
  for (const [slice, key] of [[recent, "recent"], [earlier, "earlier"]] as const) {
    for (const attempt of slice) {
      for (const [name, row] of Object.entries((attempt.subjectBreakdown as unknown as Breakdown) ?? {})) {
        const bucket = momentum.get(name) ?? { recentCorrect: 0, recentTotal: 0, earlierCorrect: 0, earlierTotal: 0 };
        bucket[`${key}Correct`] += row.correct;
        bucket[`${key}Total`] += row.correct + row.incorrect;
        momentum.set(name, bucket);
      }
    }
  }
  const subjectMomentum = [...momentum.entries()]
    .filter(([, row]) => row.recentTotal >= 2 && row.earlierTotal >= 2)
    .map(([name, row]) => ({
      name,
      recent: Math.round((row.recentCorrect / row.recentTotal) * 1000) / 10,
      earlier: Math.round((row.earlierCorrect / row.earlierTotal) * 1000) / 10,
      delta: Math.round(((row.recentCorrect / row.recentTotal) - (row.earlierCorrect / row.earlierTotal)) * 1000) / 10,
    }))
    .sort((left, right) => right.delta - left.delta);

  return {
    attempts,
    records: records.reverse(),
    readiness,
    subjects,
    weakTopics,
    totalQuestions,
    totalAttempts,
    averageAccuracy: attempts.length ? attempts.reduce((sum, attempt) => sum + toNumber(attempt.accuracy), 0) / attempts.length : 0,
    bestScore: attempts.reduce((best, attempt) => Math.max(best, toNumber(attempt.scorePercent)), 0),
    totalStudyMinutes: records.reduce((sum, record) => sum + record.studyMinutes, 0),
    negativeMarksLost: Math.round(negativeMarksLost * 100) / 100,
    averageTimePerQuestion,
    subjectMomentum,
  };
}

export async function getPlannerData(userId: string, exam: CandidateExam) {
  const today = todayDate();
  const [goals, revision, nextEvent, weakTopics] = await Promise.all([
    prisma.dailyGoal.findMany({ where: { userId, examId: exam.examId, goalDate: today }, orderBy: { order: "asc" } }),
    prisma.revisionQueue.findMany({
      where: { userId, examId: exam.examId, status: "PENDING" },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      take: 40,
      include: {
        question: { select: {
          id: true, text: true, topicId: true, subject: { select: { id: true, name: true } },
          topic: { select: { id: true, title: true } },
        } },
        topic: { select: { id: true, title: true } },
      },
    }),
    prisma.examCalendar.findFirst({
      where: { examId: exam.examId, startDate: { gte: today }, status: { in: ["CONFIRMED", "TENTATIVE"] } },
      orderBy: { startDate: "asc" },
    }),
    prisma.examAttempt.findMany({
      where: { userId, examId: exam.examId, status: "SUBMITTED" },
      orderBy: { submittedAt: "desc" },
      take: 10,
      select: { topicBreakdown: true },
    }),
  ]);

  const unresolvedSubjects = [...new Set(revision.flatMap((item) =>
    !item.topic && !item.question?.topic && item.question?.subject.id ? [item.question.subject.id] : [],
  ))];
  const topicIndex: Awaited<ReturnType<typeof loadTopicIndex>> = unresolvedSubjects.length
    ? await loadTopicIndex(exam.examId, unresolvedSubjects)
    : new Map();
  const revisionWithTopic = revision.map((item) => {
    const direct = item.topic ?? item.question?.topic ?? null;
    const resolved = direct ?? pickTopic(item.question?.text ?? "", item.question?.subject.id ?? null, topicIndex);
    return { ...item, resolvedTopic: resolved ? { id: resolved.id, title: resolved.title } : null };
  });

  const weakMap = new Map<string, { total: number; correct: number }>();
  for (const attempt of weakTopics) {
    for (const [title, row] of Object.entries((attempt.topicBreakdown as unknown as Breakdown) ?? {})) {
      const current = weakMap.get(title) ?? { total: 0, correct: 0 };
      current.total += row.correct + row.incorrect;
      current.correct += row.correct;
      weakMap.set(title, current);
    }
  }
  const weakest = [...weakMap.entries()]
    .filter(([, row]) => row.total >= 2)
    .map(([title, row]) => ({ title, accuracy: (row.correct / row.total) * 100 }))
    .sort((left, right) => left.accuracy - right.accuracy)
    .slice(0, 5);

  const plan: StudyPlanSuggestion = fallbackPlan({
    examName: exam.name,
    level: exam.level,
    daysToExam: exam.targetExamDate ? Math.max(0, daysBetween(today, exam.targetExamDate)) : null,
    dailyMinutes: exam.dailyMinutes,
    weakTopics: weakest.map((topic) => topic.title),
    userId,
    examId: exam.examId,
  });

  return {
    goals,
    revision: revisionWithTopic,
    dueRevision: revisionWithTopic.filter((item) => item.dueDate.getTime() <= today.getTime()),
    nextEvent,
    weakest,
    plan,
    daysToExam: exam.targetExamDate ? Math.max(0, daysBetween(today, exam.targetExamDate)) : null,
  };
}

export async function getCalendarData(userId: string, exam: CandidateExam) {
  const exams = await prisma.candidateExamTarget.findMany({
    where: { userId, active: true },
    select: { examId: true, targetExamDate: true, exam: { select: { code: true, name: true } } },
  });
  const events = await prisma.examCalendar.findMany({
    where: { examId: { in: exams.map((item) => item.examId) } },
    orderBy: { startDate: "asc" },
    take: 80,
    include: { exam: { select: { code: true, name: true } } },
  });
  return { events, exams, selectedExamId: exam.examId };
}

export async function getSyllabusView(userId: string, exam: CandidateExam) {
  const units = await prisma.syllabusUnit.findMany({
    where: { examId: exam.examId, active: true },
    orderBy: [{ subjectId: "asc" }, { order: "asc" }],
    include: {
      subject: { select: { id: true, name: true, slug: true } },
      chapters: {
        where: { active: true },
        orderBy: { order: "asc" },
        include: {
          topics: {
            where: { active: true },
            orderBy: { order: "asc" },
            include: {
              progress: { where: { userId }, select: { status: true, completion: true, lastStudiedAt: true, bookmarked: true } },
              materials: { where: { active: true }, select: { id: true }, take: 1 },
              _count: { select: { materials: true } },
            },
          },
        },
      },
    },
  });

  const subjectMap = new Map<string, { id: string; name: string; units: typeof units }>();
  for (const unit of units) {
    const current = subjectMap.get(unit.subject.id) ?? { id: unit.subject.id, name: unit.subject.name, units: [] };
    current.units.push(unit);
    subjectMap.set(unit.subject.id, current);
  }

  const subjects = [...subjectMap.values()].map((subject) => {
    const topics = subject.units.flatMap((unit) => unit.chapters.flatMap((chapter) => chapter.topics));
    const completed = topics.filter((topic) => topic.progress[0]?.status === "COMPLETED").length;
    return { ...subject, topicCount: topics.length, completed, percent: percent(completed, topics.length) };
  });

  return { units, subjects };
}

export async function getTopicView(userId: string, topicId: string) {
  const topic = await prisma.syllabusTopic.findUnique({
    where: { id: topicId },
    include: {
      chapter: { include: { unit: { include: { subject: true } } } },
      progress: { where: { userId } },
      materials: { where: { active: true }, orderBy: { order: "asc" } },
      _count: { select: { questions: true } },
    },
  });
  if (!topic) return null;
  const exam = await prisma.exam.findUnique({ where: { id: topic.chapter.unit.examId }, select: { code: true, name: true, officialUrl: true } });
  return { topic, progress: topic.progress[0] ?? null, exam };
}

export async function getNotifications(userId: string) {
  return prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 60 });
}

export async function getCandidateProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, phone: true, dateOfBirth: true, gender: true, state: true, city: true,
      education: true, currentEducationLevel: true, preferredLanguage: true, avatarUrl: true, dailyStudyMinutes: true,
      timezone: true, createdAt: true, lastActiveAt: true,
      accountConsent: { select: { ageBand: true, country: true, acceptedAt: true } },
      subscription: { select: { plan: true, status: true, trialEndsAt: true, endsAt: true } },
      candidateExamTargets: {
        where: { active: true },
        include: { exam: { select: { name: true, code: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  return user;
}
