import { Prisma } from "@/generated/prisma/client";
import type { z } from "zod";
import type { AuthUser } from "@/server/auth/session";
import { assertStudent } from "@/server/student/service";
import { ConflictApiError, ValidationApiError } from "@/server/api/errors";
import { prisma } from "@/server/db";
import { scoreAnswer } from "./scoring";
import { answerSchema } from "./validation";
const published = { status: "PUBLISHED" as const, active: true };
const resultSelect = { id: true, questionId: true, questionText: true, correct: true, score: true, maximumScore: true,
  explanation: true, submittedAt: true };

export async function submitPracticeAnswer(user: AuthUser, input: z.infer<typeof answerSchema>) {
  assertStudent(user);
  const answer = input.optionIds ? { optionIds: [...input.optionIds].sort() } : { numerical: input.numerical! };
  for (let retry = 0; retry < 3; retry++) {
    try { return await prisma.$transaction(async (tx) => {
      const existing = await tx.practiceAttempt.findUnique({ where: { userId_requestKey: { userId: user.id, requestKey: input.requestKey } } });
      if (existing) {
        if (existing.questionId !== input.questionId || JSON.stringify(existing.answer) !== JSON.stringify(answer)) throw new ConflictApiError("This submission identifier was already used");
        return tx.practiceAttempt.findUnique({ where: { id: existing.id }, select: resultSelect });
      }
      const profile = await tx.studentProfile.findUnique({ where: { userId: user.id }, select: { targetExamId: true } });
      if (!profile?.targetExamId) throw new ValidationApiError("Choose your target exam first");
      const link = await tx.questionExam.findFirst({ where: { examId: profile.targetExamId, questionId: input.questionId,
        ...published, exam: published, question: { ...published, reviewStatus: "REVIEWED", subject: published, chapter: { ...published, subject: published } } },
        select: { examId: true, marks: true, negativeMarks: true, scoringMode: true, question: { select: { id: true, text: true,
          type: true, numericalAnswer: true, explanation: true, options: { where: { active: true }, select: { id: true, isCorrect: true } } } } } });
      if (!link) throw new ValidationApiError("Practice question was not found");
      const result = scoreAnswer({ type: link.question.type, mode: link.scoringMode, marks: link.marks.toString(),
        negativeMarks: link.negativeMarks.toString(), numericalAnswer: link.question.numericalAnswer, options: link.question.options }, answer);
      return tx.practiceAttempt.create({ data: { userId: user.id, questionId: link.question.id, examId: link.examId,
        requestKey: input.requestKey, answer, ...result, scoringMode: link.scoringMode!, explanation: link.question.explanation,
        questionText: link.question.text }, select: resultSelect });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || !["P2002", "P2034"].includes(error.code)) throw error;
      if (retry === 2) throw new ConflictApiError("Submission changed. Try again with the same identifier");
    }
  }
  throw new ConflictApiError("Unable to submit answer");
}
export async function getPracticeHistory(user: AuthUser) {
  assertStudent(user);
  return prisma.practiceAttempt.findMany({ where: { userId: user.id }, orderBy: [{ submittedAt: "desc" }, { id: "desc" }], take: 100, select: resultSelect });
}
export async function getPracticeHistoryPage(user: AuthUser, cursor?: string) {
  assertStudent(user);
  const anchor = cursor ? await prisma.practiceAttempt.findFirst({ where: { id: cursor, userId: user.id }, select: { id: true, submittedAt: true } }) : null;
  if (cursor && !anchor) throw new ValidationApiError("History cursor was not found");
  const rows = await prisma.practiceAttempt.findMany({ where: { userId: user.id,
    ...(anchor ? { OR: [{ submittedAt: { lt: anchor.submittedAt } }, { submittedAt: anchor.submittedAt, id: { lt: anchor.id } }] } : {}) },
    orderBy: [{ submittedAt: "desc" }, { id: "desc" }], take: 51, select: resultSelect });
  return { records: rows.slice(0, 50), nextCursor: rows.length > 50 ? rows[49].id : null };
}
