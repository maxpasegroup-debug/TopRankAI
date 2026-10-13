import { studentRead, studentMutation } from "@/server/api/student-handler";
import { getPracticeRevision, mutatePracticeRevision, revisionMutationSchema } from "@/server/practice/revision";
import { prisma } from "@/server/db";
import { z } from "zod";
export const GET = studentRead(async (user, request) => {
  const questionId = new URL(request.url).searchParams.get("questionId");
  if (!questionId) return getPracticeRevision(user);
  const row = await prisma.practiceRevisionState.findUnique({ where: { userId_questionId: { userId: user.id, questionId: z.string().min(1).max(100).parse(questionId) } }, select: { bookmarked: true } });
  return { bookmarked: row?.bookmarked ?? false };
});
export const POST = studentMutation(revisionMutationSchema, mutatePracticeRevision);
