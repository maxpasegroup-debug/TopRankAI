import { z } from "zod";
import type { AuthUser } from "@/server/auth/session";
import { AuthorizationApiError, ValidationApiError } from "@/server/api/errors";
import { prisma } from "@/server/db";
import { Prisma } from "@/generated/prisma/client";
import { ConflictApiError } from "@/server/api/errors";
import { scoreAnswer } from "@/server/practice/scoring";
import { safeResourceUrl } from "@/server/content/resource-url";
import { assertReviewedPublication } from "@/server/content/editorial";
import { assertQuestionReviewed, assertQuestionParentsPublished } from "@/server/question/authoring";
import { inAppNotice } from "@/server/notifications/service";
export const entitySchema = z.enum(["EXAM", "SUBJECT", "EXAM_SUBJECT", "CHAPTER", "LESSON", "RESOURCE", "QUESTION", "QUESTION_EXAM"]);
export const publicationSchema = z.object({ entity: entitySchema, id: z.string().min(1).max(100),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]), active: z.boolean(),
  reviewStatus: z.enum(["NEEDS_REVIEW", "REVIEWED"]).optional(),
  scoringMode: z.enum(["EXACT_SET", "DECIMAL_EXACT"]).optional(),
}).strict().refine((v) => (v.reviewStatus === undefined || v.entity === "QUESTION") && (v.scoringMode === undefined || v.entity === "QUESTION_EXAM"));
export function assertPlatformAdmin(user: AuthUser) {
  if (user.role !== "PLATFORM_ADMIN") throw new AuthorizationApiError("Platform administrator access required");
}
export const examCategories = ["CENTRAL_RECRUITMENT", "STATE_RECRUITMENT", "CIVIL_SERVICES", "BANKING", "RAILWAYS", "DEFENCE", "ENGINEERING", "MEDICAL", "UNIVERSITY", "MANAGEMENT", "LAW", "TEACHING", "RESEARCH", "OTHER"] as const;
export const examCreateSchema = z.object({ code: z.string().trim().min(2).max(40).regex(/^[A-Z0-9_]+$/), name: z.string().trim().min(3).max(160),
  category: z.enum(examCategories), description: z.string().trim().max(2000).optional(),
  officialUrl: z.string().max(500).optional().refine((value) => !value || Boolean(safeResourceUrl(value))) }).strict();
export async function createExam(user: AuthUser, input: z.infer<typeof examCreateSchema>) {
  assertPlatformAdmin(user);
  try { return await prisma.$transaction(async (tx) => {
    const exam = await tx.exam.create({ data: { ...input, officialUrl: input.officialUrl || null, status: "DRAFT" }, select: { id: true } });
    await tx.auditEvent.create({ data: { actorId: user.id, entity: "EXAM", entityId: exam.id, action: "EXAM_CREATED_DRAFT" } });
    return exam;
  }); } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictApiError("This exam code already exists");
    throw error;
  }
}
export async function listPublicationRecords(user: AuthUser, entity: z.infer<typeof entitySchema>) {
  assertPlatformAdmin(user);
  const options = { take: 100, orderBy: { updatedAt: "desc" as const } };
  switch (entity) {
    case "EXAM": return prisma.exam.findMany({ ...options, select: { id: true, name: true, status: true, active: true } });
    case "SUBJECT": return prisma.subject.findMany({ ...options, select: { id: true, name: true, status: true, active: true } });
    case "EXAM_SUBJECT": return prisma.examSubject.findMany({ ...options, select: { id: true, examId: true, subjectId: true, status: true, active: true } });
    case "CHAPTER": return prisma.chapter.findMany({ ...options, select: { id: true, title: true, status: true, active: true } });
    case "LESSON": return prisma.lesson.findMany({ ...options, select: { id: true, title: true, status: true, active: true } });
    case "RESOURCE": return prisma.learningResource.findMany({ ...options, select: { id: true, title: true, url: true, reference: true, status: true, active: true } });
    case "QUESTION": return prisma.question.findMany({ ...options, select: { id: true, code: true, text: true, type: true, reviewStatus: true,
      status: true, active: true, numericalAnswer: true, options: { where: { active: true }, select: { id: true, text: true, isCorrect: true } } } });
    case "QUESTION_EXAM": return prisma.questionExam.findMany({ ...options, select: { id: true, questionId: true, examId: true, scoringMode: true, marks: true, negativeMarks: true, status: true, active: true } });
  }
}
export async function changePublication(user: AuthUser, input: z.infer<typeof publicationSchema>) {
  assertPlatformAdmin(user);
  return prisma.$transaction(async (tx) => {
    const data = { status: input.status, active: input.active };
    if (input.status === "PUBLISHED" && !["QUESTION", "QUESTION_EXAM"].includes(input.entity)) await assertReviewedPublication(tx, input.entity, input.id);
    switch (input.entity) {
      case "EXAM": await tx.exam.update({ where: { id: input.id }, data }); break;
      case "SUBJECT": await tx.subject.update({ where: { id: input.id }, data }); break;
      case "EXAM_SUBJECT": await tx.examSubject.update({ where: { id: input.id }, data }); break;
      case "CHAPTER": await tx.chapter.update({ where: { id: input.id }, data }); break;
      case "LESSON": await tx.lesson.update({ where: { id: input.id }, data }); break;
      case "RESOURCE": {
        const resource = await tx.learningResource.findUnique({ where: { id: input.id }, select: { url: true } });
        if (!resource || (input.status === "PUBLISHED" && resource.url && !safeResourceUrl(resource.url))) throw new ValidationApiError("Provide a safe HTTPS resource before publishing");
        await tx.learningResource.update({ where: { id: input.id }, data }); break;
      }
      case "QUESTION": {
        if (input.status === "PUBLISHED" || input.reviewStatus === "REVIEWED") {
          const reviewed = await assertQuestionReviewed(tx, input.id);
          if (input.status === "PUBLISHED") await assertQuestionParentsPublished(tx, reviewed);
        }
        const question = await tx.question.findUnique({ where: { id: input.id }, include: { options: { where: { active: true } }, exams: { where: { active: true, status: "PUBLISHED" } } } });
        if (!question) throw new ValidationApiError("Question was not found");
        if (input.status === "PUBLISHED") {
          if ((input.reviewStatus ?? question.reviewStatus) !== "REVIEWED" || !question.exams.length) throw new ValidationApiError("Review this question and configure an exam link before publishing");
          for (const link of question.exams) scoreAnswer({ type: question.type, mode: link.scoringMode, marks: link.marks.toString(), negativeMarks: link.negativeMarks.toString(), numericalAnswer: question.numericalAnswer, options: question.options },
            question.type === "NUMERICAL" ? { numerical: question.numericalAnswer ?? "" } : { optionIds: question.options.filter((o) => o.isCorrect).map((o) => o.id) });
        }
        await tx.question.update({ where: { id: input.id }, data: { ...data, reviewStatus: input.reviewStatus } }); break;
      }
      case "QUESTION_EXAM": {
        const link = await tx.questionExam.findUnique({ where: { id: input.id } });
        if (!link) throw new ValidationApiError("Question exam link was not found");
        if (input.scoringMode && input.scoringMode !== link.scoringMode) throw new ValidationApiError("Create a newly reviewed question instead of changing its scoring");
        if (input.status === "PUBLISHED") await assertQuestionParentsPublished(tx, await assertQuestionReviewed(tx, link.questionId));
        await tx.questionExam.update({ where: { id: input.id }, data }); break;
      }
    }
    await tx.auditEvent.create({ data: { actorId: user.id, entity: input.entity, entityId: input.id, action: `PUBLICATION_${input.status}` } });
    return { id: input.id };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
export const helpResponseSchema = z.object({ id: z.string().min(1).max(100), version: z.number().int().nonnegative(), status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]),
  response: z.string().trim().min(1).max(2000) }).strict();
export async function listSupportQueue(user: AuthUser) {
  assertPlatformAdmin(user);
  return prisma.helpRequest.findMany({ orderBy: [{ status: "asc" }, { createdAt: "asc" }, { id: "asc" }], take: 100,
    select: { id: true, subject: true, message: true, status: true, response: true, version: true } });
}
export async function respondToHelp(user: AuthUser, input: z.infer<typeof helpResponseSchema>) {
  assertPlatformAdmin(user);
  input = helpResponseSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const current = await tx.helpRequest.findUnique({ where: { id: input.id } });
    if (!current) throw new ValidationApiError("Support request is unavailable");
    if (current.status === input.status && current.response === input.response) return { id: current.id, version: current.version };
    const changed = await tx.helpRequest.updateMany({ where: { id: input.id, version: input.version }, data: { status: input.status, response: input.response, version: { increment: 1 } } });
    if (changed.count !== 1) throw new ConflictApiError("Support request changed. Reload before replying.");
    await inAppNotice(tx, current.userId, `help:${current.id}:${input.version + 1}`, "SUPPORT_UPDATED");
    await tx.auditEvent.create({ data: { actorId: user.id, entity: "HELP_REQUEST", entityId: input.id, action: `HELP_${input.status}` } });
    return { id: input.id, version: input.version + 1 };
  });
}
