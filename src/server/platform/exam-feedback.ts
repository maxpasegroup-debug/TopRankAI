import { prisma } from "@/server/db";
import { logger } from "@/server/logger";
import { fallbackFeedback, generateExamFeedback, type FeedbackInput } from "@/server/ai/tasks";

export function isExamFeedbackPending(feedback: unknown, submittedAt: Date | null) {
  return Boolean(
    feedback && typeof feedback === "object" && "source" in feedback && feedback.source === "PENDING"
    && submittedAt && Date.now() - submittedAt.getTime() < 60_000,
  );
}

export async function finishExamFeedback(attemptId: string, input: FeedbackInput) {
  let feedback = fallbackFeedback(input);
  let source = "DETERMINISTIC";
  try {
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
