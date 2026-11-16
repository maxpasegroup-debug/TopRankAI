"use server";

import { cookies } from "next/headers";
import { prisma } from "@/server/db";
import { requireAuth } from "@/server/auth/session";
import { generateStudyNotes, suggestStudyPlan, type StudyNotes, type StudyPlanSuggestion } from "@/server/ai/tasks";
import { evaluateAchievements } from "@/server/platform/achievements";
import { getCandidateExams, getSelectedExam } from "@/server/platform/candidate";
import { ensureDailyExam, startDailyExam, submitDailyExam } from "@/server/platform/daily-exam";
import { getPlannerData, getTopicView } from "@/server/platform/insights";
import { markAllNotificationsRead, markNotificationRead } from "@/server/platform/notifications";
import { todayDate } from "@/server/platform/utils";
import { readExamPattern } from "@/server/platform/patterns";
import { getOfficialSyllabusExcerpt } from "@/server/platform/syllabus-sources";
import { profileUpdateSchema, syllabusProgressSchema, attemptAnswerSchema, examSelectionSchema } from "@/server/platform/validation";
import { ACTIVE_EXAM_COOKIE } from "@/server/platform/cookies";
import { includedPapers, MAX_DAILY_PAPERS, mockMonthlyActive } from "@/shared/daily-workload";
import { targetWorkload } from "@/server/platform/target-workload";
import { ValidationApiError } from "@/server/api/errors";
import { z } from "zod";

export type PlatformActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; message: string };

export async function setActiveExam(code: string) {
  const user = await requireAuth();
  const exams = await getCandidateExams(user.id);
  if (!exams.some((exam) => exam.code === code)) return { ok: false as const, message: "That exam is not in your plan." };
  const store = await cookies();
  store.set(ACTIVE_EXAM_COOKIE, code, { httpOnly: false, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return { ok: true as const };
}

export async function prepareDailyExam(code: string, slot = 0) {
  const user = await requireAuth();
  try {
    const exam = await getSelectedExam(user.id, code);
    if (!exam || exam.code !== code) return { ok: false as const, message: "Choose at least one exam before starting a daily paper." };
    const dailyExam = await ensureDailyExam(user.id, exam, slot);
    return { ok: true as const, data: { id: dailyExam.id } };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : "Could not prepare the daily exam." };
  }
}

export async function beginDailyExam(dailyExamId: string) {
  const user = await requireAuth();
  try {
    const attemptId = await startDailyExam(user.id, dailyExamId);
    return { ok: true as const, data: { attemptId } };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : "Could not start the paper." };
  }
}

export async function submitExamAttempt(attemptId: string, answers: unknown) {
  const user = await requireAuth();
  const parsed = attemptAnswerSchema.safeParse(answers);
  if (!parsed.success) return { ok: false as const, message: "The submitted answers were not valid. Please reload the paper." };
  try {
    const result = await submitDailyExam(user.id, attemptId, parsed.data);
    return { ok: true as const, data: { attemptId: result.attemptId } };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : "Could not submit the paper." };
  }
}

export async function updateTopicProgress(raw: unknown) {
  const user = await requireAuth();
  const parsed = syllabusProgressSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, message: "Choose a valid topic status." };
  const { topicId, status, bookmarked, notes } = parsed.data;
  const topic = await prisma.syllabusTopic.findUnique({
    where: { id: topicId },
    select: { id: true, chapter: { select: { unit: { select: { examId: true } } } } },
  });
  if (!topic) return { ok: false as const, message: "Topic not found." };
  const target = await prisma.candidateExamTarget.findFirst({ where: { userId: user.id, examId: topic.chapter.unit.examId, active: true } });
  if (!target) return { ok: false as const, message: "This topic belongs to an exam outside your plan." };
  await prisma.topicProgress.upsert({
    where: { userId_topicId: { userId: user.id, topicId } },
    update: {
      status,
      completion: status === "COMPLETED" ? 100 : status === "NEEDS_REVISION" || status === "LEARNING" ? 50 : 0,
      lastStudiedAt: status === "NOT_STARTED" ? undefined : new Date(),
      ...(bookmarked === undefined ? {} : { bookmarked }),
      ...(notes === undefined ? {} : { notes }),
    },
    create: {
      userId: user.id,
      topicId,
      status,
      completion: status === "COMPLETED" ? 100 : status === "LEARNING" || status === "NEEDS_REVISION" ? 50 : 0,
      lastStudiedAt: status === "NOT_STARTED" ? null : new Date(),
      bookmarked: bookmarked ?? false,
      notes: notes ?? null,
    },
  });
  await evaluateAchievements(user.id);
  return { ok: true as const, data: { status } };
}

/**
 * Records that the candidate opened a topic. It powers "Continue studying"
 * without changing a topic the candidate has already completed or flagged.
 */
export async function recordTopicVisit(topicId: string): Promise<PlatformActionResult<null>> {
  const user = await requireAuth();
  const topic = await prisma.syllabusTopic.findUnique({
    where: { id: topicId },
    select: { chapter: { select: { unit: { select: { examId: true } } } } },
  });
  if (!topic) return { ok: false, message: "Topic not found." };
  const target = await prisma.candidateExamTarget.findFirst({
    where: { userId: user.id, examId: topic.chapter.unit.examId, active: true },
    select: { id: true },
  });
  if (!target) return { ok: false, message: "This topic is outside your preparation plan." };
  const existing = await prisma.topicProgress.findUnique({
    where: { userId_topicId: { userId: user.id, topicId } },
    select: { id: true },
  });
  if (existing) {
    await prisma.topicProgress.update({ where: { id: existing.id }, data: { lastStudiedAt: new Date() } });
  } else {
    await prisma.topicProgress.create({
      data: { userId: user.id, topicId, status: "LEARNING", lastStudiedAt: new Date() },
    });
  }
  return { ok: true, data: null };
}

export async function requestTopicNotes(topicId: string): Promise<PlatformActionResult<StudyNotes>> {  const user = await requireAuth();
  const view = await getTopicView(user.id, topicId);
  if (!view) return { ok: false, message: "Topic not found." };
  if (!view.exam) return { ok: false, message: "This topic is not attached to an exam." };
  const target = await prisma.candidateExamTarget.findFirst({ where: { userId: user.id, examId: view.topic.chapter.unit.examId, active: true } });
  if (!target) return { ok: false, message: "This topic is outside your preparation plan." };
  const excerpt = await getOfficialSyllabusExcerpt(
    view.topic.chapter.unit.examId,
    view.topic.chapter.unit.subjectId,
    view.topic.title,
    view.topic.description, view.topic.chapter.title, view.topic.chapter.unit.subject.name, view.exam.code,
  );
  const result = await generateStudyNotes({
    examName: view.exam.name,
    subjectName: view.topic.chapter.unit.subject.name,
    topicTitle: view.topic.title,
    topicDescription: view.topic.description ?? "",
    userId: user.id,
    examId: view.topic.chapter.unit.examId,
    syllabusText: excerpt?.text ?? view.topic.content,
  });
  if (!result.ok) return { ok: false, message: result.message };

  const notesContent = [
    "## Overview",
    result.data.overview,
    "",
    "## Key points",
    ...result.data.keyPoints.map((point) => `- ${point}`),
    ...(result.data.formulas.length ? ["", "## Formulas", ...result.data.formulas.map((formula) => `- ${formula}`)] : []),
    ...(result.data.workedExample
      ? ["", "## Worked example", `**Question:** ${result.data.workedExample.question}`, "", `**Solution:** ${result.data.workedExample.solution}`]
      : []),
    ...(result.data.commonMistakes.length ? ["", "## Common mistakes", ...result.data.commonMistakes.map((item) => `- ${item}`)] : []),
  ].join("\n");

  const existing = await prisma.studyMaterial.findFirst({
    where: { topicId, title: "AI-generated detailed notes", active: true },
    select: { id: true },
  });
  if (existing) {
    await prisma.studyMaterial.update({
      where: { id: existing.id },
      data: { content: notesContent, active: true },
    });
  } else {
    await prisma.studyMaterial.create({
      data: {
        topicId,
        title: "AI-generated detailed notes",
        type: "NOTES",
        content: notesContent,
        order: -1,
        active: true,
      },
    });
  }
  return { ok: true, data: result.data };
}

export async function completeRevisionItem(id: string) {
  const user = await requireAuth();
  const item = await prisma.revisionQueue.findFirst({ where: { id, userId: user.id, status: "PENDING" } });
  if (!item) return { ok: false as const, message: "Revision item not found." };
  await prisma.revisionQueue.update({ where: { id: item.id }, data: { status: "COMPLETED", completedAt: new Date() } });
  const goals = await prisma.dailyGoal.findMany({ where: { userId: user.id, examId: item.examId, goalDate: todayDate(), type: "REVISION", completedAt: null } });
  for (const goal of goals) {
    const progress = Math.min(goal.target, goal.progress + 1);
    await prisma.dailyGoal.update({ where: { id: goal.id }, data: { progress, completedAt: progress >= goal.target ? new Date() : null } });
  }
  return { ok: true as const };
}

export async function dismissRevisionItem(id: string) {
  const user = await requireAuth();
  await prisma.revisionQueue.updateMany({ where: { id, userId: user.id, status: "PENDING" }, data: { status: "DISMISSED" } });
  return { ok: true as const };
}

export async function requestStudyPlan(code: string): Promise<PlatformActionResult<{ plan: StudyPlanSuggestion; aiGenerated: boolean }>> {
  const user = await requireAuth();
  const exam = await getSelectedExam(user.id, code);
  if (!exam) return { ok: false, message: "Choose an exam first." };
  const planner = await getPlannerData(user.id, exam);
  const result = await suggestStudyPlan({
    examName: exam.name,
    level: exam.level,
    daysToExam: planner.daysToExam,
    dailyMinutes: exam.dailyMinutes,
    weakTopics: planner.weakest.map((topic) => topic.title),
    userId: user.id,
    examId: exam.examId,
  });
  return { ok: true, data: result };
}

export async function updateCandidateProfile(raw: unknown) {
  const user = await requireAuth();
  const parsed = profileUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false as const, message: issue?.message ?? "Check the profile details.", field: issue?.path.join(".") };
  }
  const input = parsed.data;
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: input.name,
        dateOfBirth: new Date(`${input.dateOfBirth}T00:00:00.000Z`),
        gender: input.gender,
        state: input.state,
        city: input.city,
        education: input.education,
        preferredLanguage: input.preferredLanguage === "English" ? "en" : input.preferredLanguage,
        phone: input.phone || null,
        avatarUrl: input.avatarUrl || null,
        dailyStudyMinutes: input.dailyStudyMinutes,
        timezone: input.timezone,
      },
    });
    return { ok: true as const };
  } catch {
    return { ok: false as const, message: "Could not save the profile. The phone number may already be in use." };
  }
}

export async function saveDailyWorkload(targetId: string, count: number, activateMonthly: boolean) {
  const user = await requireAuth();
  const exam = (await getCandidateExams(user.id)).find((item) => item.targetId === targetId);
  if (!exam || !Number.isInteger(count) || count < 1 || count > MAX_DAILY_PAPERS) {
    return { ok: false, message: "Choose a valid number of daily papers." };
  }
  return prisma.$transaction(async (tx) => {
    const target = await tx.candidateExamTarget.findFirst({ where: { id: targetId, userId: user.id, active: true } });
    if (!target) return { ok: false, message: "Choose an active exam first." };
    let subscription = await tx.subscription.findUnique({ where: { userId: user.id } });
    const included = includedPapers(target.preparationLevel);
    const extra = count > included;
    let mockPayment = false;
    let monthlyUntil = mockMonthlyActive(subscription) ? subscription!.endsAt : null;
    if (extra && !mockMonthlyActive(subscription)) {
      if (activateMonthly !== true) {
        return { ok: false, message: "Activate the mock monthly plan for extra papers." };
      }
      if (subscription && !["FREE", "MOCK_MONTHLY"].includes(subscription.plan)) {
        return { ok: false, message: "Your existing subscription cannot be replaced by the mock plan." };
      }
      const startsAt = new Date();
      const endsAt = new Date(startsAt.getTime() + 30 * 86_400_000);
      const monthly = {
        plan: "MOCK_MONTHLY",
        status: "ACTIVE" as const,
        startsAt,
        endsAt,
        features: { mockPayment: true, source: "mock-monthly-checkout" },
      };
      subscription = await tx.subscription.upsert({
        where: { userId: user.id },
        create: { userId: user.id, ...monthly },
        update: monthly,
      });
      monthlyUntil = endsAt;
      mockPayment = true;
    }
    await tx.candidateExamTarget.update({
      where: { id: target.id },
      data: { dailyPaperCount: count },
    });
    return {
      ok: true,
      message: mockPayment
        ? "Mock payment successful — no money was charged. Extra papers are active."
        : "Daily schedule saved.",
      data: { mockPayment, monthlyUntil },
    };
  });
}

const targetListSchema = z.array(examSelectionSchema).min(1).max(8);

export async function updateExamPlan(raw: unknown) {
  const user = await requireAuth();
  const parsed = targetListSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, message: "Choose at least one exam and a valid preparation level." };
  const exams = await prisma.exam.findMany({
    where: { id: { in: parsed.data.map((item) => item.examId) }, active: true },
    select: { id: true, code: true, name: true, configuration: { select: { sections: true } } },
  });
  if (exams.length !== parsed.data.length) return { ok: false as const, message: "One or more exams are unavailable." };
  const examById = new Map(exams.map((exam) => [exam.id, exam]));
  const partByExam = new Map<string, string | null>();
  for (const item of parsed.data) {
    const exam = examById.get(item.examId);
    if (!exam) return { ok: false as const, message: "One or more exams are unavailable." };
    const pattern = readExamPattern(exam.configuration?.sections);
    const part = item.partCode ? pattern?.parts.find((entry) => entry.code === item.partCode) ?? null : pattern?.parts[0] ?? null;
    if (item.partCode && !part) return { ok: false as const, message: `Choose a valid paper for ${exam.name}.` };
    partByExam.set(item.examId, part?.code ?? null);
  }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.candidateExamTarget.updateMany({ where: { userId: user.id, active: true, examId: { notIn: exams.map((exam) => exam.id) } }, data: { active: false } });
      for (const item of parsed.data) {
        const workload = await targetWorkload(tx, user.id, item.examId, item.level);
        await tx.candidateExamTarget.updateMany({
          where: { userId: user.id, examId: item.examId, targetYear: { not: item.targetYear }, active: true }, data: { active: false },
        });
        await tx.candidateExamTarget.upsert({
          where: { userId_examId_targetYear: { userId: user.id, examId: item.examId, targetYear: item.targetYear } },
          update: { ...workload, dailyMinutes: item.dailyMinutes, examPart: partByExam.get(item.examId) ?? null, active: true },
          create: { userId: user.id, examId: item.examId, targetYear: item.targetYear, ...workload, dailyMinutes: item.dailyMinutes, examPart: partByExam.get(item.examId) ?? null, active: true },
        });
      }
    }, { timeout: 20_000 });
  } catch (error) {
    if (error instanceof ValidationApiError) return { ok: false as const, message: error.message };
    throw error;
  }
  return { ok: true as const };
}

export async function readNotification(id: string) {
  const user = await requireAuth();
  await markNotificationRead(user.id, id);
  return { ok: true as const };
}

export async function readAllNotifications() {
  const user = await requireAuth();
  await markAllNotificationsRead(user.id);
  return { ok: true as const };
}
