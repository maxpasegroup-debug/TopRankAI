import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db";
import type { AuthUser } from "@/server/auth/session";
import { assertPlatformAdmin } from "@/server/operations/service";
import { ConflictApiError, ValidationApiError } from "@/server/api/errors";
import { editorialFingerprint } from "@/server/content/editorial";
import { safeResourceUrl } from "@/server/content/resource-url";
import { scoreAnswer, decimalPattern } from "@/server/practice/scoring";

const id = z.string().trim().min(1).max(100);
const evidence = z.string().trim().min(8).max(1000);
const draft = z.object({ action: z.literal("CREATE"), code: z.string().regex(/^[A-Z0-9_-]{2,100}$/),
  text: z.string().trim().min(1).max(5000), type: z.enum(["SINGLE_CHOICE", "MULTIPLE_CHOICE", "NUMERICAL"]),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]), chapterId: id, lessonId: id.optional(), supersedesId: id.optional(),
  explanation: z.string().trim().min(8).max(5000), language: z.string().trim().min(2).max(20),
  options: z.array(z.object({ code: z.string().regex(/^[A-Z0-9_-]{1,20}$/), text: z.string().trim().min(1).max(2000), isCorrect: z.boolean() }).strict()).max(12),
  numericalAnswer: z.string().max(60).regex(decimalPattern).optional(),
  exams: z.array(z.object({ examId: id, marks: z.number().positive().max(999).multipleOf(0.01), negativeMarks: z.number().min(0).max(999).multipleOf(0.01) }).strict()).min(1).max(20),
  sourceTitle: z.string().trim().min(1).max(250), sourceUrl: z.string().max(500).optional().refine(v => !v || Boolean(safeResourceUrl(v))),
  rightsHolder: z.string().trim().min(1).max(250), origin: z.enum(["ORIGINAL", "LICENSED", "PUBLIC_REFERENCE", "AI_ASSISTED"]),
  licence: evidence, permissionEvidence: evidence, attribution: z.string().trim().max(1000),
}).strict().superRefine((v, ctx) => {
  if (new Set(v.options.map(o => o.code)).size !== v.options.length || new Set(v.exams.map(e => e.examId)).size !== v.exams.length)
    ctx.addIssue({ code: "custom", message: "Duplicate option or exam codes" });
  const count = v.options.filter(o => o.isCorrect).length;
  if (v.type === "NUMERICAL" ? !v.numericalAnswer || v.options.length > 0 : Boolean(v.numericalAnswer) || v.options.length < 2 || (v.type === "SINGLE_CHOICE" ? count !== 1 : count < 1))
    ctx.addIssue({ code: "custom", message: "Provide valid protected answers for this question type" });
});
export const questionMutationSchema = z.union([draft, z.object({ action: z.enum(["REVIEW", "PUBLISH", "ARCHIVE"]), id,
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/), evidence }).strict()]);

export async function questionRevision(tx: Prisma.TransactionClient, questionId: string) {
  return tx.question.findUnique({ where: { id: questionId }, select: { id: true, code: true, text: true, type: true, difficulty: true,
    chapterId: true, subjectId: true, lessonId: true, supersedesId: true, explanation: true, language: true, numericalAnswer: true,
    options: { orderBy: { code: "asc" }, select: { id: true, code: true, text: true, isCorrect: true, active: true } },
    exams: { orderBy: { examId: "asc" }, select: { id: true, examId: true, marks: true, negativeMarks: true, scoringMode: true, active: true } } } });
}
export async function assertQuestionReviewed(tx: Prisma.TransactionClient, questionId: string) {
  const record = await questionRevision(tx, questionId);
  if (!record?.explanation?.trim() || !record.exams.length) throw new ValidationApiError("An explanation and scored exam links are required");
  const where = { entity_entityId: { entity: "QUESTION", entityId: questionId } };
  const review = await tx.contentEditorialRecord.findUnique({ where });
  const source = await tx.contentSource.findUnique({ where });
  const fingerprint = editorialFingerprint(record);
  if (!review?.reviewerId || review.authorId === review.reviewerId || !review.reviewedAt || !review.reviewEvidence ||
      review.reviewedRevision !== review.revision || review.reviewedFingerprint !== fingerprint ||
      !source?.reviewerId || source.authorId === source.reviewerId || !source.reviewedAt || source.contentFingerprint !== fingerprint ||
      !source.licence || !source.rightsHolder || !source.permissionEvidence)
    throw new ValidationApiError("Independent question, explanation and licence review of this revision is required");
  for (const link of record.exams) scoreAnswer({ type: record.type, mode: link.scoringMode, marks: link.marks.toString(),
    negativeMarks: link.negativeMarks.toString(), numericalAnswer: record.numericalAnswer, options: record.options.filter(o => o.active) },
    record.type === "NUMERICAL" ? { numerical: record.numericalAnswer ?? "" } : { optionIds: record.options.filter(o => o.active && o.isCorrect).map(o => o.id) });
  return record;
}
export async function assertQuestionParentsPublished(tx: Prisma.TransactionClient, record: NonNullable<Awaited<ReturnType<typeof questionRevision>>>) {
  const published = { status: "PUBLISHED" as const, active: true };
  if (!await tx.chapter.findFirst({ where: { id: record.chapterId, ...published, subject: published } })) throw new ValidationApiError("Publish the chapter and subject first");
  for (const link of record.exams) {
    if (!await tx.exam.findFirst({ where: { id: link.examId, ...published } }) || !await tx.examSubject.findFirst({ where: { examId: link.examId, subjectId: record.subjectId, ...published } }))
      throw new ValidationApiError("Publish the exam and its subject association first");
  }
}
export async function manageQuestion(user: AuthUser, raw: z.infer<typeof questionMutationSchema>) {
  assertPlatformAdmin(user); const input = questionMutationSchema.parse(raw);
  try { return await prisma.$transaction(async tx => {
    let questionId: string;
    if (input.action === "CREATE") {
      const chapter = await tx.chapter.findUnique({ where: { id: input.chapterId }, select: { subjectId: true } });
      if (!chapter) throw new ValidationApiError("Chapter was not found");
      if (input.lessonId && !await tx.lesson.findFirst({ where: { id: input.lessonId, chapterId: input.chapterId } })) throw new ValidationApiError("Lesson must belong to this chapter");
      for (const exam of input.exams) if (!await tx.examSubject.findUnique({ where: { examId_subjectId: { examId: exam.examId, subjectId: chapter.subjectId } } })) throw new ValidationApiError("Exam must include this subject");
      if (input.supersedesId) {
        const original = await tx.question.findUnique({ where: { id: input.supersedesId }, select: { chapterId: true } });
        if (!original || original.chapterId !== input.chapterId) throw new ValidationApiError("A revision must reference an existing question in this chapter");
      }
      if (await tx.question.findFirst({ where: { text: input.text, chapterId: input.chapterId, ...(input.supersedesId ? { id: { not: input.supersedesId } } : {}) }, select: { id: true } })) throw new ConflictApiError("An identical question already exists in this chapter");
      const question = await tx.question.create({ data: { code: input.code, text: input.text, type: input.type, difficulty: input.difficulty,
        chapterId: input.chapterId, subjectId: chapter.subjectId, lessonId: input.lessonId, explanation: input.explanation, language: input.language,
        numericalAnswer: input.numericalAnswer, supersedesId: input.supersedesId, status: "DRAFT", reviewStatus: "NEEDS_REVIEW",
        options: { create: input.options.map((o, order) => ({ ...o, order })) },
        exams: { create: input.exams.map(e => ({ ...e, status: "DRAFT", scoringMode: input.type === "NUMERICAL" ? "DECIMAL_EXACT" : "EXACT_SET" })) } }, select: { id: true } });
      questionId = question.id;
      const fingerprint = editorialFingerprint(await questionRevision(tx, questionId));
      await tx.contentEditorialRecord.create({ data: { entity: "QUESTION", entityId: questionId, authorId: user.id } });
      await tx.contentSource.create({ data: { entity: "QUESTION", entityId: questionId, title: input.sourceTitle, url: input.sourceUrl || null,
        rightsHolder: input.rightsHolder, origin: input.origin, licence: input.licence, permissionEvidence: input.permissionEvidence,
        attribution: input.attribution, authorId: user.id, contentFingerprint: fingerprint } });
    } else {
      questionId = input.id;
      const record = await questionRevision(tx, questionId);
      if (!record || editorialFingerprint(record) !== input.fingerprint) throw new ConflictApiError("Question changed. Reload before deciding");
      const where = { entity_entityId: { entity: "QUESTION", entityId: questionId } };
      if (input.action === "REVIEW") {
        const review = await tx.contentEditorialRecord.findUnique({ where });
        const source = await tx.contentSource.findUnique({ where });
        if (!review || !source || review.authorId === user.id || source.authorId === user.id) throw new ValidationApiError("A different author-independent reviewer is required");
        const state = await tx.question.findUnique({ where: { id: questionId }, select: { status: true } });
        if (state?.status !== "DRAFT") throw new ValidationApiError("Only drafts can be reviewed");
        await tx.contentEditorialRecord.update({ where, data: { reviewerId: user.id, reviewedRevision: review.revision, reviewedFingerprint: input.fingerprint, reviewEvidence: input.evidence, reviewedAt: new Date() } });
        await tx.contentSource.update({ where, data: { reviewerId: user.id, reviewedAt: new Date() } });
        await assertQuestionReviewed(tx, questionId);
        await tx.question.update({ where: { id: questionId }, data: { reviewStatus: "REVIEWED" } });
      } else if (input.action === "PUBLISH") {
        await assertQuestionReviewed(tx, questionId);
        await assertQuestionParentsPublished(tx, record);
        await tx.questionExam.updateMany({ where: { questionId }, data: { status: "PUBLISHED", active: true } });
        await tx.question.update({ where: { id: questionId }, data: { status: "PUBLISHED", active: true, reviewStatus: "REVIEWED" } });
      } else await tx.question.update({ where: { id: questionId }, data: { status: "ARCHIVED", active: false } });
    }
    await tx.auditEvent.create({ data: { actorId: user.id, entity: "QUESTION", entityId: questionId, action: `QUESTION_${input.action}`,
      ...(input.action !== "CREATE" ? { detail: JSON.stringify({ evidence: input.evidence }) } : {}) } });
    return { id: questionId };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) throw new ConflictApiError("Question changed or code already exists. Reload before retrying");
    throw error;
  }
}
