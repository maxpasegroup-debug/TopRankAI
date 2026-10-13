import { Prisma } from "@/generated/prisma/client";
import { createHash } from "node:crypto";
import { AuthorizationApiError, ConflictApiError, ValidationApiError } from "@/server/api/errors";
import type { AuthUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { assertStudent } from "@/server/student/service";
import { requireResourceAccess } from "@/server/commerce/access";
import { previewStudyPlan } from "./planner";
import { journeySchema, learningProgressSchema, planSchema, sessionSchema, taskSchema } from "./validation";
import type { z } from "zod";
import { assertDailyCapacity, assertFutureStudyDate } from "./schedule";
import { calendarDay } from "@/shared/study-calendar";

const published = { status: "PUBLISHED" as const, active: true };
const profileSelect = { aspiration: true, targetExamId: true, targetYear: true, dreamCollege: true,
  targetScore: true, dailyStudyMins: true, preparationStart: true, focusSubjectIds: true, onboardingCompletedAt: true };

export async function getJourney(user: AuthUser) {
  assertStudent(user);
  const profile = await prisma.studentProfile.findUnique({ where: { userId: user.id }, select: profileSelect });
  const exams = await prisma.exam.findMany({ where: published, orderBy: { name: "asc" },
    select: { id: true, name: true, code: true, category: true, description: true, officialUrl: true } });
  const subjects = profile?.targetExamId ? await prisma.examSubject.findMany({
    where: { examId: profile.targetExamId, ...published, subject: published }, orderBy: { order: "asc" },
    select: { subject: { select: { id: true, name: true } } },
  }) : [];
  return { profile, exams, subjects: subjects.map((row) => row.subject) };
}

export async function saveJourney(user: AuthUser, input: z.infer<typeof journeySchema>) {
  assertStudent(user);
  return prisma.$transaction(async (tx) => {
    const current = await tx.studentProfile.findUnique({ where: { userId: user.id } });
    if (!current) throw new ValidationApiError("Student profile does not exist");
    const examId = input.targetExamId ?? current.targetExamId;
    if (examId && !await tx.exam.findFirst({ where: { id: examId, ...published } })) {
      throw new ValidationApiError("Selected exam is unavailable");
    }
    const changedExam = input.targetExamId !== undefined && input.targetExamId !== current.targetExamId;
    const focus = input.focusSubjectIds ?? (changedExam ? [] : current.focusSubjectIds);
    if (focus.length) {
      const count = await tx.examSubject.count({ where: { examId: examId ?? "", subjectId: { in: focus }, ...published, subject: published } });
      if (count !== focus.length) throw new ValidationApiError("Choose subjects from your selected exam");
    }
    return tx.studentProfile.update({ where: { userId: user.id }, data: { ...input, focusSubjectIds: focus,
      onboardingCompletedAt: changedExam ? null : undefined }, select: profileSelect });
  });
}

export async function previewJourneyPlan(user: AuthUser, db: Prisma.TransactionClient = prisma, startDate?: Date) {
  assertStudent(user);
  const profile = await db.studentProfile.findUnique({ where: { userId: user.id } });
  if (!profile?.targetExamId || !profile.targetYear || !profile.dreamCollege || !profile.dailyStudyMins || !profile.preparationStart) {
    throw new ValidationApiError("Save your exam, target year, goal, start date and daily study time first");
  }
  const links = await db.examSubject.findMany({
    where: { examId: profile.targetExamId, exam: published, ...published,
      subjectId: profile.focusSubjectIds.length ? { in: profile.focusSubjectIds } : undefined, subject: published },
    orderBy: [{ order: "asc" }, { id: "asc" }],
    select: { subject: { select: { id: true, name: true, slug: true,
      chapters: { where: published, orderBy: [{ order: "asc" }, { id: "asc" }], take: 10,
        select: { slug: true, lessons: { where: published, orderBy: [{ order: "asc" }, { id: "asc" }],
          take: 10, select: { id: true, title: true, slug: true } } } },
    } } },
  });
  const lessons = [];
  for (const { subject } of links) for (const chapter of subject.chapters) for (const lesson of chapter.lessons) {
    if (lessons.length >= 21) continue;
    try { await requireResourceAccess("LESSON", lesson.id, user, db); }
    catch (error) { if (error instanceof AuthorizationApiError) continue; throw error; }
    lessons.push({ title: lesson.title, subject: subject.name, href: `/learn/${subject.slug}/${chapter.slug}/${lesson.slug}` });
  }
  for (const { subject } of links) {
    if (lessons.length >= 21) break;
    if (await db.questionExam.findFirst({ where: { examId: profile.targetExamId, ...published, exam: published, scoringMode: { not: null }, question: { ...published, reviewStatus: "REVIEWED", subjectId: subject.id, subject: published, chapter: { ...published, subject: published } } }, select: { id: true } })) {
      lessons.push({ title: `Practice: ${subject.name}`, subject: subject.name, href: `/practice/subjects/${subject.slug}/questions` });
    }
  }
  if (!lessons.length) throw new ValidationApiError("No available lessons or reviewed practice activities are published for this exam yet");
  const effectiveStart = startDate ?? new Date(Math.max(profile.preparationStart.getTime(), new Date(calendarDay(new Date(), "Asia/Kolkata")).getTime()));
  if (startDate) assertFutureStudyDate(startDate, "UTC");
  const preview = { examId: profile.targetExamId, startDate: effectiveStart, dailyMinutes: profile.dailyStudyMins,
    tasks: previewStudyPlan(effectiveStart, profile.dailyStudyMins, lessons) };
  return { ...preview, previewToken: createHash("sha256").update(JSON.stringify(preview)).digest("hex") };
}

export async function confirmJourneyPlan(user: AuthUser, input: z.infer<typeof planSchema>) {
  assertStudent(user);
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await prisma.$transaction(async (tx) => {
    const existing = await tx.studyPlan.findUnique({ where: { userId_requestKey: { userId: user.id, requestKey: input.requestKey } } });
    if (existing) return { id: existing.id };
    const preview = await previewJourneyPlan(user, tx, input.startDate);
    if (preview.previewToken !== input.previewToken) throw new ConflictApiError("Your goals or lessons changed. Review the plan again");
    await tx.studyPlan.updateMany({ where: { userId: user.id, active: true }, data: { active: false } });
    const plan = await tx.studyPlan.create({ data: { userId: user.id, title: input.title, requestKey: input.requestKey,
      examId: preview.examId, startDate: preview.startDate, dailyMinutes: preview.dailyMinutes, tasks: { create: preview.tasks } } });
    await tx.studentProfile.update({ where: { userId: user.id }, data: { onboardingCompletedAt: new Date() } });
    return { id: plan.id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || !["P2034", "P2002"].includes(error.code)) throw error;
      if (attempt === 2) throw new ConflictApiError("Your plan changed. Refresh and try again");
    }
  }
  throw new ConflictApiError("Your plan changed. Refresh and try again");
}

export async function getMissionBoard(user: AuthUser) {
  assertStudent(user);
  return prisma.studyPlan.findFirst({ where: { userId: user.id, active: true }, orderBy: { createdAt: "desc" },
    include: { tasks: { orderBy: [{ dueDate: "asc" }, { id: "asc" }], take: 500 } } });
}

export async function changeMissionTask(user: AuthUser, input: z.infer<typeof taskSchema>) {
  assertStudent(user);
  return prisma.$transaction(async (tx) => {
    const task = await tx.missionTask.findFirst({ where: { id: input.id, plan: { userId: user.id, active: true } }, include: { plan: true } });
    if (!task) throw new ValidationApiError("Mission task was not found");
    const status = input.status ?? task.status;
    const dueDate = input.dueDate ?? task.dueDate;
    const minutes = input.minutes ?? task.minutes;
    if (status === task.status && dueDate.getTime() === task.dueDate.getTime() && minutes === task.minutes) return { id: task.id, version: task.version };
    if (input.dueDate) assertFutureStudyDate(dueDate, input.timezone ?? "Asia/Kolkata");
    if (status !== "SKIPPED" && (input.dueDate || input.minutes !== undefined || task.status === "SKIPPED")) await assertDailyCapacity(tx, task.planId, task.plan.dailyMinutes, dueDate, minutes, task.id);
    const changed = await tx.missionTask.updateMany({ where: { id: task.id, version: input.version, plan: { userId: user.id, active: true } },
      data: { status, dueDate, minutes, completedAt: status === "COMPLETED" ? task.completedAt ?? new Date() : null, version: { increment: 1 } } });
    if (changed.count !== 1) throw new ConflictApiError("This task changed. Refresh and try again");
    await tx.missionTaskEvent.create({ data: { taskId: task.id, status, dueDate } });
    return { id: task.id, version: input.version + 1 };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch(error => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code)) throw new ConflictApiError("Your schedule changed. Refresh before retrying.");
    throw error;
  });
}

export async function updateStudySession(user: AuthUser, input: z.infer<typeof sessionSchema>) {
  assertStudent(user);
  if (input.action === "start") {
    for (let attempt = 0; attempt < 3; attempt++) {
      try { return await prisma.$transaction(async (tx) => {
        const existing = await tx.studySession.findUnique({ where: { userId_requestKey: { userId: user.id, requestKey: input.requestKey } } });
        if (existing) {
          if (existing.topic !== input.topic || (existing.taskId ?? null) !== (input.taskId ?? null)) throw new ConflictApiError("This session identifier was used for different work");
          return { id: existing.id, topic: existing.topic, startedAt: existing.startedAt, endedAt: existing.endedAt };
        }
        if (input.taskId && !await tx.missionTask.findFirst({ where: { id: input.taskId, status: "TODO", plan: { userId: user.id, active: true } } })) throw new ValidationApiError("Choose an unfinished mission from your current plan");
        if (await tx.studySession.findFirst({ where: { userId: user.id, endedAt: null } })) throw new ConflictApiError("Finish your current study session first");
        return tx.studySession.create({ data: { userId: user.id, requestKey: input.requestKey, topic: input.topic, taskId: input.taskId },
          select: { id: true, topic: true, startedAt: true, endedAt: true } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || !["P2034", "P2002"].includes(error.code)) throw error;
        if (attempt === 2) throw new ConflictApiError("Study session changed. Refresh and try again");
      }
    }
  }
  if (input.action !== "stop") throw new ConflictApiError("Unable to start study session");
  await prisma.studySession.updateMany({ where: { id: input.id, userId: user.id, endedAt: null }, data: { endedAt: new Date() } });
  const session = await prisma.studySession.findFirst({ where: { id: input.id, userId: user.id },
    select: { id: true, topic: true, startedAt: true, endedAt: true } });
  if (!session) throw new ValidationApiError("Study session was not found");
  return session;
}

export async function getCurrentStudySession(user: AuthUser) {
  assertStudent(user);
  return prisma.studySession.findFirst({ where: { userId: user.id, endedAt: null },
    select: { id: true, topic: true, startedAt: true, endedAt: true } });
}

export async function updateLearningProgress(user: AuthUser, input: z.infer<typeof learningProgressSchema>) {
  assertStudent(user);
  const lesson = await prisma.lesson.findFirst({ where: { id: input.lessonId, ...published,
    chapter: { ...published, subject: published } }, select: { id: true } });
  if (!lesson) throw new ValidationApiError("Lesson was not found");
  await requireResourceAccess("LESSON", input.lessonId, user);
  const existing = await prisma.studentLessonProgress.findUnique({ where: { userId_lessonId: { userId: user.id, lessonId: input.lessonId } } });
  const completedAt = input.completed === undefined ? undefined : input.completed ? existing?.completedAt ?? new Date() : null;
  return prisma.studentLessonProgress.upsert({ where: { userId_lessonId: { userId: user.id, lessonId: input.lessonId } },
    create: { userId: user.id, lessonId: input.lessonId, bookmarked: input.bookmarked, completedAt },
    update: { bookmarked: input.bookmarked, completedAt }, select: { lessonId: true, bookmarked: true, completedAt: true } });
}

export async function getLearningProgress(user: AuthUser, lessonId: string) {
  assertStudent(user);
  return prisma.studentLessonProgress.findUnique({ where: { userId_lessonId: { userId: user.id, lessonId } },
    select: { bookmarked: true, completedAt: true } });
}

export async function getVerifiedProgress(user: AuthUser) {
  assertStudent(user);
  const [completedTasks, completedLessons, sessions, saved] = await Promise.all([
    prisma.missionTask.count({ where: { plan: { userId: user.id }, status: "COMPLETED" } }),
    prisma.studentLessonProgress.count({ where: { userId: user.id, completedAt: { not: null } } }),
    prisma.studySession.findMany({ where: { userId: user.id, endedAt: { not: null } }, orderBy: { startedAt: "desc" }, take: 100,
      select: { topic: true, startedAt: true, endedAt: true } }),
    prisma.studentLessonProgress.findMany({ where: { userId: user.id, bookmarked: true, lesson: { ...published, chapter: { ...published, subject: published } } },
      take: 100, select: { lesson: { select: { title: true, slug: true, chapter: { select: { slug: true, subject: { select: { slug: true } } } } } } } }),
  ]);
  return { completedTasks, completedLessons,
    recordedMinutes: sessions.reduce((sum, session) => sum + Math.max(0, Math.min(720, Math.floor((session.endedAt!.getTime() - session.startedAt.getTime()) / 60000))), 0),
    sessions, saved: saved.map(({ lesson }) => ({ title: lesson.title, href: `/learn/${lesson.chapter.subject.slug}/${lesson.chapter.slug}/${lesson.slug}` })) };
}
