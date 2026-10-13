import { studentRead, studentMutation } from "@/server/api/student-handler";
import { submitPracticeAnswer, getPracticeHistory, getPracticeHistoryPage } from "@/server/practice/service";
import { answerSchema } from "@/server/practice/validation";
import { z } from "zod";
export const GET = studentRead(async (user, request) => {
  const params = new URL(request.url).searchParams;
  if (params.get("page") !== "1") return getPracticeHistory(user);
  const cursor = params.get("cursor");
  return getPracticeHistoryPage(user, cursor ? z.string().min(1).max(100).parse(cursor) : undefined);
});
export const POST = studentMutation(answerSchema, submitPracticeAnswer);
