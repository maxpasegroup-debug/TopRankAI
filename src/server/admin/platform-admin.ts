import { DAILY_PAPERS } from "@/shared/daily-workload";
import { prisma } from "@/server/db";
import { aiConfiguration } from "@/server/env";
import type { GeneratedQuestion } from "@/server/ai/tasks";
import { notify } from "@/server/platform/notifications";
import { slugify, startOfDayUtc } from "@/server/platform/utils";
import type { z } from "zod";
import { calendarImportSchema, syllabusImportSchema } from "@/server/platform/validation";

export async function getAdminOverview() {
  const today = startOfDayUtc();
  const [users, candidates, exams, questions, pendingQuestions, topics, attemptsToday, aiToday, recentUsers, recentAttempts, aiLogs, calendar] = await Promise.all([
    prisma.user.count({ where: { role: { in: ["CANDIDATE", "STUDENT"] } } }),
    prisma.user.count({ where: { role: "CANDIDATE" } }),
    prisma.exam.count({ where: { active: true } }),
    prisma.question.count({ where: { active: true } }),
    prisma.question.count({ where: { active: true, reviewStatus: "NEEDS_REVIEW" } }),
    prisma.syllabusTopic.count({ where: { active: true } }),
    prisma.examAttempt.count({ where: { submittedAt: { gte: today } } }),
    prisma.aIUsageLog.count({ where: { createdAt: { gte: today } } }),
    prisma.user.findMany({ where: { role: { in: ["CANDIDATE", "STUDENT"] } }, orderBy: { createdAt: "desc" }, take: 6, select: { id: true, name: true, email: true, role: true, createdAt: true, status: true } }),
    prisma.examAttempt.findMany({ where: { status: "SUBMITTED" }, orderBy: { submittedAt: "desc" }, take: 8, include: { user: { select: { name: true, email: true } }, exam: { select: { name: true, code: true } } } }),
    prisma.aIUsageLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.examCalendar.count({ where: { startDate: { gte: today } } }),
  ]);
  return { counts: { users, candidates, exams, questions, pendingQuestions, topics, attemptsToday, aiToday, calendar }, recentUsers, recentAttempts, aiLogs, ai: aiConfiguration() };
}

export async function listAdminExams() {
  return prisma.exam.findMany({
    where: { active: true },
    orderBy: [{ name: "asc" }],
    include: {
      examCategory: true,
      configuration: true,
      _count: { select: { examSubjects: true, questionExams: true, candidateTargets: true, dailyExams: true } },
      examSubjects: { include: { subject: { select: { name: true, code: true } } }, orderBy: { order: "asc" } },
    },
  });
}

export async function listAdminQuestions() {
  return prisma.question.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 120,
    include: {
      subject: { select: { name: true } },
      topic: { select: { title: true } },
      options: { where: { active: true }, orderBy: { order: "asc" } },
      exams: { include: { exam: { select: { code: true, name: true } } } },
    },
  });
}

export async function listAdminSyllabus(examId: string) {
  return prisma.syllabusUnit.findMany({
    where: { examId },
    orderBy: [{ subjectId: "asc" }, { order: "asc" }],
    include: {
      subject: { select: { id: true, name: true } },
      chapters: { orderBy: { order: "asc" }, include: { topics: { orderBy: { order: "asc" } } } },
    },
  });
}

export async function listAdminCalendar() {
  return prisma.examCalendar.findMany({ orderBy: { startDate: "asc" }, take: 120, include: { exam: { select: { code: true, name: true } } } });
}

export async function listAdminCandidates() {
  return prisma.user.findMany({
    where: { role: { in: ["CANDIDATE", "STUDENT"] } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true, name: true, email: true, phone: true, city: true, state: true, status: true, createdAt: true, lastActiveAt: true,
      onboardingCompletedAt: true,
      candidateExamTargets: { where: { active: true }, include: { exam: { select: { code: true, name: true } } } },
      _count: { select: { examAttempts: true } },
    },
  });
}

export async function listAdminAiLogs() {
  return prisma.aIUsageLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
}

export async function listSubjectsAndCategories() {
  const [subjects, categories] = await Promise.all([
    prisma.subject.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
    prisma.examCategory.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true, slug: true } }),
  ]);
  return { subjects, categories };
}

export async function listAdminExamOptions() {
  return prisma.exam.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true },
  });
}

export async function listAdminTopicOptions() {
  const topics = await prisma.syllabusTopic.findMany({
    where: { active: true, chapter: { active: true, unit: { active: true } } },
    orderBy: { title: "asc" },
    select: { id: true, title: true, chapter: { select: { unit: { select: { examId: true, subjectId: true } } } } },
  });
  return topics.map((topic) => ({
    id: topic.id,
    title: topic.title,
    examId: topic.chapter.unit.examId,
    subjectId: topic.chapter.unit.subjectId,
  }));
}

export async function listAdminExamSubjectOptions(examId: string) {
  const rows = await prisma.examSubject.findMany({
    where: { examId, active: true },
    orderBy: { order: "asc" },
    select: { subject: { select: { id: true, name: true } } },
  });
  return rows.map((row) => row.subject);
}

export async function createExamCategory(input: { name: string; slug: string; description?: string; order: number }) {
  return prisma.examCategory.create({ data: { name: input.name, slug: input.slug, description: input.description ?? null, order: input.order, active: true } });
}

export async function createExamWithConfiguration(input: {
  code: string; name: string; shortName?: string; categoryId: string; description?: string; officialUrl?: string;
  durationMinutes: number; totalQuestions: number; dailyTestQuestions: number; dailyTestMinutes: number;
  positiveMarks: number; negativeMarks: number; markingNote?: string; subjectIds: string[];
}) {
  const category = await prisma.examCategory.findUnique({ where: { id: input.categoryId } });
  if (!category) throw new Error("Choose a valid category.");
  return prisma.$transaction(async (tx) => {
    const exam = await tx.exam.create({
      data: {
        code: input.code,
        name: input.name,
        shortName: input.shortName || null,
        category: category.name,
        categoryId: category.id,
        description: input.description ?? null,
        officialUrl: input.officialUrl || null,
        defaultPreparationLevel: "BEGINNER",
        status: "PUBLISHED",
        active: true,
      },
    });
    await tx.examConfiguration.create({
      data: {
        examId: exam.id,
        durationMinutes: input.durationMinutes,
        totalQuestions: input.totalQuestions,
        dailyTestQuestions: input.dailyTestQuestions,
        dailyTestMinutes: input.dailyTestMinutes,
        positiveMarks: input.positiveMarks,
        negativeMarks: input.negativeMarks,
        markingNote: input.markingNote ?? null,
        sourceUrl: input.officialUrl || null,
        questionTypes: ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "NUMERICAL"],
        dailyTestCount: DAILY_PAPERS,
        active: true,
      },
    });
    for (const [index, subjectId] of input.subjectIds.entries()) {
      await tx.examSubject.create({ data: { examId: exam.id, subjectId, order: index + 1, status: "PUBLISHED", active: true } });
    }
    return exam;
  }, { timeout: 20_000 });
}

export async function updateExamConfiguration(input: {
  examId: string; name: string; shortName?: string; description?: string; officialUrl?: string;
  durationMinutes: number; totalQuestions: number; dailyTestQuestions: number; dailyTestMinutes: number;
  positiveMarks: number; negativeMarks: number; markingNote?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const exam = await tx.exam.update({
      where: { id: input.examId },
      data: {
        name: input.name,
        shortName: input.shortName || null,
        description: input.description ?? null,
        officialUrl: input.officialUrl || null,
      },
    });
    await tx.examConfiguration.upsert({
      where: { examId: input.examId },
      update: {
        durationMinutes: input.durationMinutes,
        totalQuestions: input.totalQuestions,
        dailyTestQuestions: input.dailyTestQuestions,
        dailyTestMinutes: input.dailyTestMinutes,
        positiveMarks: input.positiveMarks,
        negativeMarks: input.negativeMarks,
        markingNote: input.markingNote ?? null,
        active: true,
      },
      create: {
        examId: input.examId,
        durationMinutes: input.durationMinutes,
        totalQuestions: input.totalQuestions,
        dailyTestQuestions: input.dailyTestQuestions,
        dailyTestMinutes: input.dailyTestMinutes,
        positiveMarks: input.positiveMarks,
        negativeMarks: input.negativeMarks,
        markingNote: input.markingNote ?? null,
        questionTypes: ["SINGLE_CHOICE"],
        active: true,
      },
    });
    return exam;
  }, { timeout: 30_000 });
}

export async function createQuestionRecord(input: {
  code: string; text: string; type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "NUMERICAL"; difficulty: "EASY" | "MEDIUM" | "HARD";
  subjectId: string; topicId?: string; explanation: string; numericalAnswer?: string;
  options: { text: string; correct: boolean }[]; examIds: string[]; marks: number; negativeMarks: number;
}, options?: { status?: "DRAFT" | "PUBLISHED"; sourceType?: "ADMIN_CREATED" | "AI_GENERATED"; approvedById?: string }) {
  const subject = await prisma.subject.findUnique({ where: { id: input.subjectId } });
  if (!subject) throw new Error("Choose a valid subject.");
  const topic = input.topicId ? await prisma.syllabusTopic.findUnique({ where: { id: input.topicId }, include: { chapter: true } }) : null;
  const status = options?.status ?? "PUBLISHED";
  const approved = status === "PUBLISHED";

  const question = await prisma.$transaction(async (tx) => {
    const record = await tx.question.create({
      data: {
        code: input.code,
        text: input.text,
        type: input.type,
        difficulty: input.difficulty,
        subjectId: input.subjectId,
        chapterId: topic?.chapterId ?? null,
        topicId: topic?.id ?? null,
        explanation: input.explanation,
        numericalAnswer: input.numericalAnswer || null,
        status,
        active: true,
        reviewStatus: approved ? "REVIEWED" : "NEEDS_REVIEW",
        sourceType: options?.sourceType ?? "ADMIN_CREATED",
        source: options?.sourceType === "AI_GENERATED" ? "AI draft with human approval required" : "TopRank admin editor",
        marks: input.marks,
        negativeMarks: input.negativeMarks,
        approvedAt: approved ? new Date() : null,
        approvedById: approved ? options?.approvedById ?? null : null,
        language: "en",
        tags: [],
      },
    });
    for (const [index, option] of input.options.entries()) {
      await tx.questionOption.create({
        data: { questionId: record.id, code: String.fromCharCode(65 + index), text: option.text, order: index + 1, isCorrect: option.correct, active: true },
      });
    }
    for (const examId of input.examIds) {
      await tx.questionExam.create({
        data: { questionId: record.id, examId, status, active: true, marks: input.marks, negativeMarks: input.negativeMarks },
      });
    }
    return record;
  }, { timeout: 30_000 });
  return question;
}

export async function approveQuestionRecord(questionId: string, adminId: string) {
  return prisma.$transaction(async (tx) => {
    const question = await tx.question.update({
      where: { id: questionId },
      data: { status: "PUBLISHED", reviewStatus: "REVIEWED", approvedAt: new Date(), approvedById: adminId },
      include: { options: true },
    });
    if (!question.options.some((option) => option.isCorrect) && question.type !== "NUMERICAL") throw new Error("Question has no correct option.");
    await tx.questionExam.updateMany({ where: { questionId }, data: { status: "PUBLISHED", active: true } });
    return question;
  }, { timeout: 30_000 });
}

export async function archiveQuestionRecord(questionId: string) {
  return prisma.question.update({ where: { id: questionId }, data: { status: "ARCHIVED", active: false } });
}

export async function saveAiQuestionDraft(input: {
  examId: string; subjectId: string; topicId?: string; draft: GeneratedQuestion; adminId: string;
}) {
  const exam = await prisma.exam.findUnique({ where: { id: input.examId }, include: { configuration: true } });
  if (!exam) throw new Error("Exam not found.");
  const code = `${exam.code}-AI-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  return createQuestionRecord({
    code,
    text: input.draft.text,
    type: input.draft.type,
    difficulty: input.draft.difficulty,
    subjectId: input.subjectId,
    topicId: input.topicId,
    explanation: input.draft.explanation,
    numericalAnswer: input.draft.numericalAnswer,
    options: input.draft.options,
    examIds: [input.examId],
    marks: Number(exam.configuration?.positiveMarks ?? 4),
    negativeMarks: Number(exam.configuration?.negativeMarks ?? 1),
  }, { status: "DRAFT", sourceType: "AI_GENERATED" });
}

export async function addSyllabusTopic(input: {
  examId: string; subjectId: string; unitTitle: string; unitDescription?: string;
  chapterTitle: string; chapterDescription?: string; topicTitle: string; topicDescription?: string; content?: string;
}) {
  const examSubject = await prisma.examSubject.findUnique({ where: { examId_subjectId: { examId: input.examId, subjectId: input.subjectId } } });
  if (!examSubject) throw new Error("Add the subject to the exam before adding syllabus topics.");
  const unitSlug = slugify(input.unitTitle);
  const chapterSlug = slugify(input.chapterTitle);
  const topicSlug = slugify(input.topicTitle);
  const unit = await prisma.syllabusUnit.upsert({
    where: { examId_subjectId_slug: { examId: input.examId, subjectId: input.subjectId, slug: unitSlug } },
    update: { title: input.unitTitle, description: input.unitDescription ?? undefined, active: true },
    create: { examId: input.examId, subjectId: input.subjectId, title: input.unitTitle, slug: unitSlug, description: input.unitDescription ?? null, order: 99, active: true },
  });
  const chapter = await prisma.syllabusChapter.upsert({
    where: { unitId_slug: { unitId: unit.id, slug: chapterSlug } },
    update: { title: input.chapterTitle, description: input.chapterDescription ?? undefined, active: true },
    create: { unitId: unit.id, title: input.chapterTitle, slug: chapterSlug, description: input.chapterDescription ?? null, order: 99, active: true },
  });
  return prisma.syllabusTopic.upsert({
    where: { chapterId_slug: { chapterId: chapter.id, slug: topicSlug } },
    update: { title: input.topicTitle, description: input.topicDescription ?? undefined, content: input.content || undefined, active: true },
    create: { chapterId: chapter.id, title: input.topicTitle, slug: topicSlug, description: input.topicDescription ?? null, content: input.content || null, order: 99, active: true },
  });
}

export async function addCalendarEvent(input: {
  examId: string; eventType: "APPLICATION_START" | "APPLICATION_END" | "ADMIT_CARD" | "EXAM" | "RESULT" | "COUNSELLING" | "OTHER";
  title: string; startDate: string; endDate?: string; status: "CONFIRMED" | "TENTATIVE" | "NOT_ANNOUNCED";
  sourceUrl?: string; sourceLabel?: string; notes?: string;
}) {
  const startDate = new Date(`${input.startDate}T00:00:00.000Z`);
  const endDate = input.endDate ? new Date(`${input.endDate}T00:00:00.000Z`) : null;
  const event = await prisma.examCalendar.create({
    data: {
      examId: input.examId,
      eventType: input.eventType,
      title: input.title,
      startDate,
      endDate,
      status: input.status,
      sourceUrl: input.sourceUrl || null,
      sourceLabel: input.sourceLabel || null,
      verifiedAt: input.status === "CONFIRMED" ? new Date() : null,
      notes: input.notes || null,
    },
    include: { exam: { select: { name: true } } },
  });
  if (input.eventType === "EXAM" && input.status !== "NOT_ANNOUNCED") {
    await prisma.candidateExamTarget.updateMany({ where: { examId: input.examId, active: true }, data: { targetExamDate: startDate } });
  }
  if (input.status === "CONFIRMED") {
    const targets = await prisma.candidateExamTarget.findMany({ where: { examId: input.examId, active: true }, select: { userId: true } });
    const label = input.eventType.replace(/_/g, " ").toLowerCase();
    for (const target of targets) {
      await notify(target.userId, "EXAM_DATE", `${event.exam.name}: ${input.title}`, `The ${label} is listed for ${startDate.toDateString()}. Source: ${input.sourceLabel || input.sourceUrl || "official notification"}.`, "/app/calendar");
    }
  }
  return event;
}

export async function setCandidateStatus(userId: string, status: "ACTIVE" | "SUSPENDED") {
  return prisma.user.update({ where: { id: userId, role: { in: ["CANDIDATE", "STUDENT"] } }, data: { status } });
}

type SyllabusImportInput = z.infer<typeof syllabusImportSchema>;
type CalendarImportInput = z.infer<typeof calendarImportSchema>;

export async function importSyllabusBundle(input: SyllabusImportInput) {
  const exam = await prisma.exam.findUnique({ where: { id: input.examId }, select: { id: true } });
  if (!exam) throw new Error("Exam not found.");

  let units = 0;
  let chapters = 0;
  let topics = 0;

  for (const group of input.subjects) {
    const subject = await prisma.subject.findFirst({
      where: { OR: [{ code: group.subjectCode }, { name: { equals: group.subjectCode, mode: "insensitive" } }] },
      select: { id: true, name: true },
    });
    if (!subject) throw new Error(`Unknown subject "${group.subjectCode}". Use its subject code or exact name.`);
    const link = await prisma.examSubject.findUnique({
      where: { examId_subjectId: { examId: exam.id, subjectId: subject.id } },
      select: { id: true },
    });
    if (!link) throw new Error(`Subject "${subject.name}" is not mapped to this exam. Add it from the exam catalogue first.`);

    for (const unitInput of group.units) {
      const unit = await prisma.syllabusUnit.upsert({
        where: { examId_subjectId_slug: { examId: exam.id, subjectId: subject.id, slug: slugify(unitInput.title) } },
        update: { title: unitInput.title, description: unitInput.description ?? undefined, active: true },
        create: { examId: exam.id, subjectId: subject.id, title: unitInput.title, slug: slugify(unitInput.title), description: unitInput.description ?? null, order: 99, active: true },
        select: { id: true },
      });
      units += 1;

      for (const chapterInput of unitInput.chapters) {
        const chapter = await prisma.syllabusChapter.upsert({
          where: { unitId_slug: { unitId: unit.id, slug: slugify(chapterInput.title) } },
          update: { title: chapterInput.title, description: chapterInput.description ?? undefined, active: true },
          create: { unitId: unit.id, title: chapterInput.title, slug: slugify(chapterInput.title), description: chapterInput.description ?? null, order: 99, active: true },
          select: { id: true },
        });
        chapters += 1;

        for (const topicInput of chapterInput.topics) {
          await prisma.syllabusTopic.upsert({
            where: { chapterId_slug: { chapterId: chapter.id, slug: slugify(topicInput.title) } },
            update: {
              title: topicInput.title,
              description: topicInput.description ?? undefined,
              content: topicInput.content || undefined,
              estimatedMinutes: topicInput.estimatedMinutes ?? undefined,
              active: true,
            },
            create: {
              chapterId: chapter.id,
              title: topicInput.title,
              slug: slugify(topicInput.title),
              description: topicInput.description ?? null,
              content: topicInput.content || null,
              estimatedMinutes: topicInput.estimatedMinutes ?? 30,
              order: 99,
              active: true,
            },
          });
          topics += 1;
        }
      }
    }
  }

  return { units, chapters, topics };
}

export async function importCalendarBundle(input: CalendarImportInput) {
  const exam = await prisma.exam.findUnique({ where: { id: input.examId }, select: { id: true } });
  if (!exam) throw new Error("Exam not found.");

  let created = 0;
  let skipped = 0;
  for (const event of input.events) {
    const startDate = new Date(`${event.startDate}T00:00:00.000Z`);
    const existing = await prisma.examCalendar.findFirst({
      where: { examId: exam.id, eventType: event.eventType, title: event.title, startDate },
      select: { id: true },
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    await addCalendarEvent({
      examId: exam.id,
      eventType: event.eventType,
      title: event.title,
      startDate: event.startDate,
      endDate: event.endDate || undefined,
      status: event.status,
      sourceUrl: input.sourceUrl || undefined,
      sourceLabel: input.sourceLabel || undefined,
      notes: event.notes,
    });
    created += 1;
  }
  return { created, skipped };
}

export async function getAdminAiPage() {
  const [logs, usage] = await Promise.all([
    listAdminAiLogs(),
    prisma.aIUsageLog.groupBy({ by: ["operation", "success"], _count: { _all: true }, _avg: { latencyMs: true } }),
  ]);
  return { config: aiConfiguration(), logs, usage };
}
