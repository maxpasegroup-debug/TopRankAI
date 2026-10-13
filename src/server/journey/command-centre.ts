import { Prisma } from "@/generated/prisma/client";
import type { z } from "zod";
import { prisma } from "@/server/db";
import type { AuthUser } from "@/server/auth/session";
import { assertStudent } from "@/server/student/service";
import { AuthorizationApiError, ConflictApiError, ValidationApiError } from "@/server/api/errors";
import { requireResourceAccess } from "@/server/commerce/access";
import { getMissionBoard } from "./service";
import { plannedTaskSchema, timezoneSchema, dateSchema } from "./validation";
import { assertDailyCapacity, assertFutureStudyDate } from "./schedule";
import { calendarDay, shiftDay, recordedSessionMinutes } from "@/shared/study-calendar";
const published = { status: "PUBLISHED" as const, active: true };
export async function getStudyChoices(user: AuthUser) {
  assertStudent(user);
  const profile = await prisma.studentProfile.findUnique({ where: { userId: user.id }, select: { targetExamId: true } });
  if (!profile?.targetExamId) return [];
  const links = await prisma.examSubject.findMany({ where: { examId: profile.targetExamId, ...published, exam: published, subject: published }, take: 20,
    select: { subject: { select: { id: true, name: true, slug: true, chapters: { where: published, take: 5, orderBy: { order: "asc" }, select: { lessons: { where: published, take: 5, orderBy: { order: "asc" }, select: { id: true, title: true } } } } } } } });
  const choices: { kind: "LESSON" | "PRACTICE"; resourceId: string; title: string }[] = [];
  for (const { subject } of links) {
    for (const chapter of subject.chapters) for (const lesson of chapter.lessons) {
      try { await requireResourceAccess("LESSON", lesson.id, user); } catch (error) { if (error instanceof AuthorizationApiError) continue; throw error; }
      if (choices.length < 100) choices.push({ kind: "LESSON", resourceId: lesson.id, title: `${subject.name}: ${lesson.title}` });
    }
    if (await prisma.questionExam.findFirst({ where: { examId: profile.targetExamId, ...published, scoringMode: { not: null }, question: { ...published, reviewStatus: "REVIEWED", subjectId: subject.id, chapter: { ...published, subject: published } } }, select: { id: true } })) choices.push({ kind: "PRACTICE", resourceId: subject.id, title: `Practice: ${subject.name}` });
  }
  return choices;
}
export async function addPlannedTask(user: AuthUser, input: z.infer<typeof plannedTaskSchema>) {
  assertStudent(user); assertFutureStudyDate(input.dueDate, input.timezone);
  try { return await prisma.$transaction(async tx => {
    const plan = await tx.studyPlan.findFirst({ where: { userId: user.id, active: true }, orderBy: { createdAt: "desc" } });
    if (!plan) throw new ValidationApiError("Confirm a weekly plan first");
    const previous = await tx.missionTask.findUnique({ where: { planId_requestKey: { planId: plan.id, requestKey: input.requestKey } } });
    let title: string; let subject: string; let href: string;
    if (input.kind === "LESSON") {
      const lesson = await tx.lesson.findFirst({ where: { id: input.resourceId, ...published, chapter: { ...published, subject: { ...published, examSubjects: { some: { examId: plan.examId, ...published, exam: published } } } } }, include: { chapter: { include: { subject: true } } } });
      if (!lesson) throw new ValidationApiError("Lesson is unavailable for your plan exam");
      await requireResourceAccess("LESSON", lesson.id, user, tx);
      title = lesson.title; subject = lesson.chapter.subject.name; href = `/learn/${lesson.chapter.subject.slug}/${lesson.chapter.slug}/${lesson.slug}`;
    } else {
      const link = await tx.questionExam.findFirst({ where: { examId: plan.examId, ...published, exam: published, scoringMode: { not: null }, question: { ...published, reviewStatus: "REVIEWED", subjectId: input.resourceId, subject: published, chapter: { ...published, subject: published } } }, select: { question: { select: { subject: { select: { name: true, slug: true } } } } } });
      if (!link) throw new ValidationApiError("No reviewed practice questions are available for this subject");
      subject = link.question.subject.name; title = `Practice: ${subject}`; href = `/practice/subjects/${link.question.subject.slug}/questions`;
    }
    if (previous) {
      if (previous.href !== href || previous.minutes !== input.minutes || previous.dueDate.getTime() !== input.dueDate.getTime()) throw new ConflictApiError("This planning identifier was already used");
      return { id: previous.id };
    }
    if (await tx.missionTask.count({ where: { planId: plan.id } }) >= 100) throw new ValidationApiError("This plan already has 100 missions. Review a new weekly plan.");
    await assertDailyCapacity(tx, plan.id, plan.dailyMinutes, input.dueDate, input.minutes);
    const task = await tx.missionTask.create({ data: { planId: plan.id, requestKey: input.requestKey, title, subject, href, minutes: input.minutes, dueDate: input.dueDate } });
    await tx.missionTaskEvent.create({ data: { taskId: task.id, status: "TODO", dueDate: input.dueDate } }); return { id: task.id };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
  catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) throw new ConflictApiError("Your schedule changed. Reload before retrying."); throw error; }
}
export async function getCommandCentre(user: AuthUser, timezoneValue: string, startValue?: string, now = new Date()) {
  assertStudent(user); const timezone = timezoneSchema.parse(timezoneValue); const today = calendarDay(now, timezone);
  const start = startValue ? dateSchema.parse(startValue).toISOString().slice(0, 10) : today;
  if (start < shiftDay(today, -365) || start > shiftDay(today, 365)) throw new ValidationApiError("Choose a week within one year of today");
  const plan = await getMissionBoard(user);
  const sessions = await prisma.studySession.findMany({ where: { userId: user.id, endedAt: { not: null, gte: new Date(shiftDay(start, -1)), lt: new Date(shiftDay(start, 8)) } }, orderBy: { endedAt: "desc" }, take: 101, select: { id: true, topic: true, startedAt: true, endedAt: true, taskId: true } });
  const recent = sessions.slice(0, 100).filter(session => { const day = calendarDay(session.endedAt!, timezone); return day >= start && day <= shiftDay(start, 6); });
  const days = Array.from({ length: 7 }, (_, offset) => {
    const date = shiftDay(start, offset); const tasks = plan?.tasks.filter(task => task.dueDate.toISOString().slice(0, 10) === date) ?? [];
    return { date, tasks, plannedMinutes: tasks.filter(task => task.status !== "SKIPPED").reduce((sum, task) => sum + task.minutes, 0), completed: tasks.filter(task => task.status === "COMPLETED").length,
      recordedMinutes: recent.filter(session => calendarDay(session.endedAt!, timezone) === date).reduce((sum, session) => sum + recordedSessionMinutes(session.startedAt, session.endedAt!), 0) };
  });
  return { today, timezone, start, plan, days, overdue: plan?.tasks.filter(task => task.status === "TODO" && task.dueDate.toISOString().slice(0, 10) < today) ?? [],
    taskListPossiblyTruncated: (plan?.tasks.length ?? 0) >= 500, sessionsTruncated: sessions.length > 100, sessions: recent, dailyBudget: plan?.dailyMinutes ?? null };
}
