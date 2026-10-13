import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db";
import type { AuthUser } from "@/server/auth/session";
import { assertStudent } from "@/server/student/service";
import { ConflictApiError, ValidationApiError } from "@/server/api/errors";
export const revisionMutationSchema = z.union([
  z.object({ questionId: z.string().min(1).max(100), action: z.literal("BOOKMARK"), bookmarked: z.boolean() }).strict(),
  z.object({ questionId: z.string().min(1).max(100), action: z.literal("REVIEW"), attemptId: z.string().min(1).max(100) }).strict(),
]);
const available = { status: "PUBLISHED" as const, active: true };
const questionSelect = { id: true, text: true, status: true, active: true, reviewStatus: true,
  subject: { select: { name: true, status: true, active: true } }, chapter: { select: { status: true, active: true } },
  lesson: { select: { slug: true, status: true, active: true, chapter: { select: { slug: true, subject: { select: { slug: true } } } } } },
  exams: { where: { ...available, exam: available }, select: { examId: true, scoringMode: true } } };
export async function getPracticeRevision(user: AuthUser) {
  assertStudent(user);
  const profile = await prisma.studentProfile.findUnique({ where: { userId: user.id }, select: { targetExamId: true } });
  const attempts = await prisma.practiceAttempt.findMany({ where: { userId: user.id }, distinct: ["questionId"],
    orderBy: [{ submittedAt: "desc" }, { id: "desc" }], take: 101,
    select: { id: true, questionId: true, questionText: true, correct: true, explanation: true, submittedAt: true, question: { select: questionSelect } } });
  const states = await prisma.practiceRevisionState.findMany({ where: { userId: user.id, OR: [{ bookmarked: true }, { questionId: { in: attempts.slice(0, 100).map(a => a.questionId) } }] }, take: 201,
    select: { questionId: true, bookmarked: true, reviewedAt: true, question: { select: questionSelect } } });
  const entries = new Map(attempts.slice(0, 100).map(a => [a.questionId, { questionId: a.questionId, text: a.questionText,
    attemptId: a.id as string | null, correct: a.correct as boolean | null, explanation: a.explanation, submittedAt: a.submittedAt as Date | null, question: a.question }]));
  for (const state of states.slice(0, 200)) if (state.bookmarked && !entries.has(state.questionId)) entries.set(state.questionId,
    { questionId: state.questionId, text: state.question.text, attemptId: null, correct: null, explanation: null, submittedAt: null, question: state.question });
  return { truncated: attempts.length > 100 || states.length > 200, entries: [...entries.values()].flatMap(entry => {
    const state = states.find(s => s.questionId === entry.questionId);
    if (entry.correct !== false && !state?.bookmarked) return [];
    const q = entry.question;
    const ready = [q, q.subject, q.chapter].every(r => r.active && r.status === "PUBLISHED") && q.reviewStatus === "REVIEWED" &&
      q.exams.some(e => e.examId === profile?.targetExamId && e.scoringMode);
    return [{ questionId: entry.questionId, text: entry.text, attemptId: entry.attemptId, explanation: entry.explanation,
      bookmarked: state?.bookmarked ?? false, incorrect: entry.correct === false,
      reviewed: Boolean(state?.reviewedAt && entry.submittedAt && state.reviewedAt >= entry.submittedAt), available: ready,
      lessonHref: ready && q.lesson?.active && q.lesson.status === "PUBLISHED" ? `/learn/${q.lesson.chapter.subject.slug}/${q.lesson.chapter.slug}/${q.lesson.slug}` : null }];
  }) };
}
export async function mutatePracticeRevision(user: AuthUser, raw: z.infer<typeof revisionMutationSchema>) {
  assertStudent(user); const input = revisionMutationSchema.parse(raw);
  try { return await prisma.$transaction(async tx => {
    const where = { userId_questionId: { userId: user.id, questionId: input.questionId } };
    if (input.action === "REVIEW") {
      const attempt = await tx.practiceAttempt.findFirst({ where: { userId: user.id, questionId: input.questionId }, orderBy: [{ submittedAt: "desc" }, { id: "desc" }], select: { id: true } });
      if (attempt?.id !== input.attemptId) throw new ConflictApiError("A newer attempt exists. Reload revision before marking reviewed");
      const current = await tx.practiceRevisionState.findUnique({ where });
      if (current?.reviewedAt) {
        const submitted = await tx.practiceAttempt.findUnique({ where: { id: input.attemptId }, select: { submittedAt: true } });
        if (submitted && current.reviewedAt >= submitted.submittedAt) return { questionId: input.questionId };
      }
    } else if (input.bookmarked) {
      const profile = await tx.studentProfile.findUnique({ where: { userId: user.id }, select: { targetExamId: true } });
      if (!profile?.targetExamId || !await tx.question.findFirst({ where: { id: input.questionId, ...available, reviewStatus: "REVIEWED",
        subject: available, chapter: { ...available, subject: available }, exams: { some: { ...available, examId: profile.targetExamId, exam: available } } }, select: { id: true } }))
        throw new ValidationApiError("An available question for your exam is required");
    } else if (!await tx.practiceRevisionState.findUnique({ where })) return { questionId: input.questionId };
    const data = input.action === "BOOKMARK" ? { bookmarked: input.bookmarked } : { reviewedAt: new Date() };
    await tx.practiceRevisionState.upsert({ where, create: { userId: user.id, questionId: input.questionId, ...data }, update: data });
    return { questionId: input.questionId };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) throw new ConflictApiError("Revision changed. Retry the same action");
    throw error;
  }
}
