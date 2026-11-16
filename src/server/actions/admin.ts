"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { Prisma } from "@/generated/prisma/client";
import { requireRole } from "@/server/auth/session";
import { generateExamPattern, generateQuestionDrafts } from "@/server/ai/tasks";
import { readExamPattern } from "@/server/platform/patterns";
import { getOfficialSyllabusExcerpt } from "@/server/platform/syllabus-sources";
import {
  addCalendarEvent,
  addSyllabusTopic,
  approveQuestionRecord,
  archiveQuestionRecord,
  createExamCategory,
  createExamWithConfiguration,
  createQuestionRecord,
  importCalendarBundle,
  importSyllabusBundle,
  saveAiQuestionDraft,
  setCandidateStatus,
  updateExamConfiguration,
} from "@/server/admin/platform-admin";
import {
  adminCalendarSchema,
  adminCategorySchema,
  adminExamSchema,
  adminQuestionSchema,
  adminSyllabusSchema,
  calendarImportSchema,
  syllabusImportSchema,
} from "@/server/platform/validation";
import { z } from "zod";

export type AdminActionResult = { ok: true; message: string } | { ok: false; message: string };
export type AiDraftActionResult = { ok: true; message: string; created: number } | { ok: false; message: string };

const adminRoles = ["PLATFORM_ADMIN"] as const;

function failure(error: unknown, fallback: string): { ok: false; message: string } {
  return { ok: false, message: error instanceof Error ? error.message : fallback };
}

export async function createCategoryAction(raw: unknown): Promise<AdminActionResult> {
  await requireRole(adminRoles);
  const parsed = adminCategorySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the category details." };
  try {
    await createExamCategory(parsed.data);
    revalidatePath("/admin/exams");
    revalidatePath("/exams");
    return { ok: true, message: "Category created." };
  } catch (error) {
    return failure(error, "Could not create the category.");
  }
}

export async function createExamAction(raw: unknown): Promise<AdminActionResult> {
  await requireRole(adminRoles);
  const parsed = adminExamSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the exam details." };
  try {
    await createExamWithConfiguration(parsed.data);
    revalidatePath("/admin/exams");
    revalidatePath("/exams");
    return { ok: true, message: "Exam created and published." };
  } catch (error) {
    return failure(error, "Could not create the exam.");
  }
}

export async function updateExamAction(examId: string, raw: unknown): Promise<AdminActionResult> {
  await requireRole(adminRoles);
  const schema = adminExamSchema.omit({ code: true, categoryId: true, subjectIds: true, dailyTestQuestions: true, dailyTestMinutes: true }).extend({
    dailyTestQuestions: z.number().int().min(3).max(30),
    dailyTestMinutes: z.number().int().min(3).max(180),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the exam details." };
  try {
    await updateExamConfiguration({ examId, ...parsed.data });
    revalidatePath("/admin/exams");
    revalidatePath("/exams");
    return { ok: true, message: "Exam configuration saved." };
  } catch (error) {
    return failure(error, "Could not save the exam.");
  }
}

export async function createQuestionAction(raw: unknown): Promise<AdminActionResult> {
  const admin = await requireRole(adminRoles);
  const parsed = adminQuestionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the question details." };
  try {
    await createQuestionRecord(parsed.data, { approvedById: admin.id });
    revalidatePath("/admin/questions");
    return { ok: true, message: "Question published to the bank." };
  } catch (error) {
    return failure(error, "Could not create the question.");
  }
}

export async function approveQuestionAction(questionId: string): Promise<AdminActionResult> {
  const admin = await requireRole(adminRoles);
  try {
    await approveQuestionRecord(questionId, admin.id);
    revalidatePath("/admin/questions");
    return { ok: true, message: "Question approved." };
  } catch (error) {
    return failure(error, "Could not approve the question.");
  }
}

export async function archiveQuestionAction(questionId: string): Promise<AdminActionResult> {
  await requireRole(adminRoles);
  try {
    await archiveQuestionRecord(questionId);
    revalidatePath("/admin/questions");
    return { ok: true, message: "Question archived." };
  } catch (error) {
    return failure(error, "Could not archive the question.");
  }
}

export async function addSyllabusAction(raw: unknown): Promise<AdminActionResult> {
  await requireRole(adminRoles);
  const parsed = adminSyllabusSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the syllabus details." };
  try {
    await addSyllabusTopic(parsed.data);
    revalidatePath("/admin/syllabus");
    return { ok: true, message: "Syllabus topic saved." };
  } catch (error) {
    return failure(error, "Could not save the syllabus topic.");
  }
}

export async function addCalendarAction(raw: unknown): Promise<AdminActionResult> {
  await requireRole(adminRoles);
  const parsed = adminCalendarSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the calendar details." };
  try {
    await addCalendarEvent(parsed.data);
    revalidatePath("/admin/calendar");
    revalidatePath("/app/calendar");
    revalidatePath("/exams");
    return { ok: true, message: "Calendar event saved." };
  } catch (error) {
    return failure(error, "Could not save the calendar event.");
  }
}

export async function importSyllabusAction(raw: unknown): Promise<AdminActionResult> {
  await requireRole(adminRoles);
  const parsed = syllabusImportSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the import payload." };
  try {
    const result = await importSyllabusBundle(parsed.data);
    revalidatePath("/admin/syllabus");
    revalidatePath("/app/learn");
    return { ok: true, message: `Imported ${result.units} units, ${result.chapters} chapters and ${result.topics} topics.` };
  } catch (error) {
    return failure(error, "Could not import the syllabus payload.");
  }
}

export async function importCalendarAction(raw: unknown): Promise<AdminActionResult> {
  await requireRole(adminRoles);
  const parsed = calendarImportSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the import payload." };
  try {
    const result = await importCalendarBundle(parsed.data);
    revalidatePath("/admin/calendar");
    revalidatePath("/app/calendar");
    revalidatePath("/exams");
    return { ok: true, message: `Imported ${result.created} events; ${result.skipped} already existed and were skipped.` };
  } catch (error) {
    return failure(error, "Could not import the calendar payload.");
  }
}

export async function setCandidateStatusAction(userId: string, status: "ACTIVE" | "SUSPENDED"): Promise<AdminActionResult> {  await requireRole(adminRoles);
  try {
    await setCandidateStatus(userId, status);
    revalidatePath("/admin/candidates");
    return { ok: true, message: `Candidate ${status === "ACTIVE" ? "reactivated" : "suspended"}.` };
  } catch (error) {
    return failure(error, "Could not update the candidate.");
  }
}

export async function saveAiDraftAction(input: {
  examId: string;
  subjectId: string;
  topicId?: string;
  draft: {
    text: string;
    type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "NUMERICAL";
    difficulty: "EASY" | "MEDIUM" | "HARD";
    options: { text: string; correct: boolean }[];
    numericalAnswer?: string;
    explanation: string;
  };
}): Promise<AdminActionResult> {
  const admin = await requireRole(adminRoles);
  try {
    await saveAiQuestionDraft({ ...input, adminId: admin.id });
    revalidatePath("/admin/questions");
    return { ok: true, message: "AI draft saved for review." };
  } catch (error) {
    return failure(error, "Could not save the AI draft.");
  }
}

export async function generateExamPatternAction(examId: string): Promise<AdminActionResult> {
  const admin = await requireRole(adminRoles);
  const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { id: true, name: true, officialUrl: true, configuration: { select: { sections: true } } } });
  if (!exam) return { ok: false, message: "Exam not found." };
  const existing = readExamPattern(exam.configuration?.sections);
  if (existing?.parts.some((part) => part.verified)) {
    return { ok: false, message: "This exam already has a verified pattern. AI will not overwrite it; edit the configuration manually if a correction is needed." };
  }

  const result = await generateExamPattern({
    examName: exam.name,
    officialUrl: exam.officialUrl,
    userId: admin.id,
    examId: exam.id,
  });
  if (!result.ok) return { ok: false, message: result.message };

  const parts = result.data.parts.map((part) => ({
    ...part,
    verified: false,
    sourceUrl: exam.officialUrl ?? part.sourceUrl,
  }));
  const primary = parts[0];
  const payload = {
    parts,
    note: result.data.note ?? "AI-generated blueprint. Verify every section against the official information bulletin before relying on it.",
  };

  try {
    await prisma.examConfiguration.upsert({
      where: { examId: exam.id },
      update: {
        sections: payload as unknown as Prisma.InputJsonValue,
        durationMinutes: primary.durationMinutes,
        totalQuestions: primary.totalQuestions,
        active: true,
      },
      create: {
        examId: exam.id,
        sections: payload as unknown as Prisma.InputJsonValue,
        durationMinutes: primary.durationMinutes,
        totalQuestions: primary.totalQuestions,
        dailyTestQuestions: 8,
        dailyTestMinutes: 12,
        active: true,
      },
    });
    revalidatePath("/admin/exams");
    revalidatePath("/exams");
    return { ok: true, message: `AI generated ${parts.length} paper part${parts.length === 1 ? "" : "s"}. It is marked “needs verification” until a human checks the official source.` };
  } catch (error) {
    return failure(error, "Could not save the AI-generated pattern.");
  }
}

export async function generateAiDraftsAction(input: {
  examId: string;
  subjectId: string;
  topicId: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  count: number;
}): Promise<AiDraftActionResult> {
  const admin = await requireRole(adminRoles);
  if (!["EASY", "MEDIUM", "HARD"].includes(input.difficulty)) return { ok: false, message: "Choose a valid difficulty." };
  const count = Math.max(1, Math.min(10, Math.trunc(input.count)));
  if (!Number.isFinite(count)) return { ok: false, message: "Choose how many drafts to generate." };

  const exam = await prisma.exam.findUnique({ where: { id: input.examId }, select: { id: true, name: true } });
  const subject = await prisma.subject.findUnique({ where: { id: input.subjectId }, select: { id: true, name: true } });
  const topic = await prisma.syllabusTopic.findUnique({
    where: { id: input.topicId },    select: {
      id: true,
      title: true,
      description: true,
      content: true,
      chapter: { select: { title: true, unit: { select: { title: true, examId: true, subjectId: true } } } },
    },
  });
  if (!exam || !subject || !topic) return { ok: false, message: "Choose a valid exam, subject and topic." };
  if (topic.chapter.unit.examId !== exam.id || topic.chapter.unit.subjectId !== subject.id) {
    return { ok: false, message: "That topic does not belong to the selected exam and subject." };
  }

  try {
    const excerpt = await getOfficialSyllabusExcerpt(exam.id, subject.id, topic.title, topic.description);
    const result = await generateQuestionDrafts({
      examName: exam.name,
      subjectName: subject.name,
      topicTitle: topic.title,
      topicDescription: topic.description ?? topic.title,
      difficulty: input.difficulty,
      count,
      userId: admin.id,
      examId: exam.id,
      syllabusText: excerpt?.text ?? topic.content,
      chapterTitle: topic.chapter.title,
      unitTitle: topic.chapter.unit.title,
      sourceReferences: excerpt?.sources.map((source) => `${source.label} (${source.url})`),
    });
    if (!result.ok) return { ok: false, message: result.message };

    let created = 0;
    for (const draft of result.data) {
      await saveAiQuestionDraft({ examId: exam.id, subjectId: subject.id, topicId: topic.id, draft, adminId: admin.id });
      created += 1;
    }
    revalidatePath("/admin/questions");
    return { ok: true, message: `${created} AI draft${created === 1 ? "" : "s"} created for review. Approve each one before it enters a paper.`, created };
  } catch (error) {
    return failure(error, "Could not generate AI drafts.");
  }
}
