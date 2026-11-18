"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/server/auth/session";
import { getSelectedExam } from "@/server/platform/candidate";
import { createCustomTest } from "@/server/platform/custom-tests";
import { protectYesterday } from "@/server/platform/streak-freeze";
import { CUSTOM_TEST_MAX_QUESTIONS, CUSTOM_TEST_MIN_QUESTIONS } from "@/shared/pro";

const customTestSchema = z.object({
  code: z.string().min(1).max(80),
  subjectIds: z.array(z.string().min(1).max(100)).max(24).default([]),
  topicIds: z.array(z.string().min(1).max(100)).max(40).default([]),
  difficulty: z.enum(["ANY", "EASY", "MEDIUM", "HARD"]).default("ANY"),
  count: z.number().int().min(CUSTOM_TEST_MIN_QUESTIONS).max(CUSTOM_TEST_MAX_QUESTIONS),
  minutes: z.number().int().min(5).max(180),
});

export type CustomTestActionResult =
  | { ok: true; data: { id: string; count: number; requested: number; minutes: number; totalMarks: number } }
  | { ok: false; message: string };

export async function buildCustomTest(raw: unknown): Promise<CustomTestActionResult> {
  const user = await requireAuth();
  const parsed = customTestSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Check the subjects, question count and time." };
  const input = parsed.data;
  const exam = await getSelectedExam(user.id, input.code);
  if (!exam || exam.code.toLowerCase() !== input.code.toLowerCase()) {
    return { ok: false, message: "That exam is not in your plan. Add it again from My exams." };
  }
  try {
    const result = await createCustomTest(user.id, exam, {
      subjectIds: input.subjectIds,
      topicIds: input.topicIds,
      difficulty: input.difficulty,
      count: input.count,
      minutes: input.minutes,
    });
    revalidatePath("/app", "layout");
    revalidatePath("/app/practice");
    revalidatePath("/app/daily");
    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not build the custom test." };
  }
}

export async function protectStreak(code: string) {
  const user = await requireAuth();
  const exam = await getSelectedExam(user.id, code);
  if (!exam || exam.code.toLowerCase() !== code.toLowerCase()) {
    return { ok: false as const, message: "That exam is not in your plan." };
  }
  try {
    const result = await protectYesterday(user.id, exam.examId);
    revalidatePath("/app", "layout");
    revalidatePath("/app/planner");
    revalidatePath("/app/analytics");
    revalidatePath("/app/daily");
    return { ok: true as const, data: result };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : "Could not protect yesterday." };
  }
}
