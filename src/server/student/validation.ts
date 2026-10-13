import { z } from "zod";

const currentYear = new Date().getFullYear();

export const studentProfileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().min(7).max(20).optional().or(z.literal("")),
  targetExamId: z.string().trim().min(1).optional(),
  targetYear: z.coerce.number().int().min(currentYear).max(currentYear + 8).optional(),
  dreamCollege: z.string().trim().min(2).max(160).optional(),
  dailyStudyHours: z.coerce.number().min(0.5).max(12).optional(),
  completeOnboarding: z.boolean().optional(),
}).strict().refine(value => value.completeOnboarding !== true, "Confirm your mission plan to finish onboarding");

export type StudentProfileUpdateInput = z.infer<typeof studentProfileUpdateSchema>;

export const onboardingStepSchema = z.object({
  step: z.enum(["exam", "year", "goal", "hours", "complete"]),
  value: z.string().trim().min(1).optional(),
});
