import { prisma } from "@/server/db";
import { logger } from "@/server/logger";
import { fallbackFeedback, generateExamFeedback, type FeedbackInput } from "@/server/ai/tasks";
import { aiRoom } from "./ai-quota";

export function isExamFeedbackPending(feedback: unknown, submittedAt: Date | null) {
  return Boolean(
    feedback && typeof feedback === "object" && "source" in feedback && feedback.source === "PENDING"
    && submittedAt && Date.now() - submittedAt.getTime() < 60_000,
  );
}

export async function finishExamFeedback(attemptId: string, input: FeedbackInput, userId?: string) {
  let feedback = fallbackFeedback(input);
  let source = "DETERMINISTIC";
  try {
    if (userId) {
      // A quota read failure must not silently downgrade the report; only a
      // confirmed exhausted allowance skips the AI call.
      try {
        const room = await aiRoom(userId, "feedback");
        if (!room.allowed || room.allowance === 0) throw new Error("Monthly AI feedback allowance spent");
      } catch (error) {
        if (error instanceof Error && error.message.includes("allowance spent")) throw error;
        logger.warn({ attemptId }, "AI quota check failed; keeping the AI attempt");
      }
    }
    const result = await generateExamFeedback(input);
    feedback = result.feedback;
    source = result.aiGenerated ? "AI" : "DETERMINISTIC";
  } catch {
    logger.warn({ attemptId }, "AI feedback failed; keeping deterministic feedback");
  }
  try {
    await prisma.examAttempt.update({
      where: { id: attemptId },
      data: { aiFeedback: { ...feedback, source } },
    });
  } catch {
    logger.warn({ attemptId }, "Feedback update failed; saved score and fallback remain available");
  }
}
