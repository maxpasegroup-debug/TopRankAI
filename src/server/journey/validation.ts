import { z } from "zod";

export const dateSchema = z.iso.date().transform((value) => new Date(`${value}T00:00:00.000Z`));
export const journeySchema = z.object({
  aspiration: z.string().trim().max(2000).optional(),
  targetExamId: z.string().min(1).max(100).optional(),
  targetYear: z.number().int().min(new Date().getFullYear()).max(new Date().getFullYear() + 8).optional(),
  dreamCollege: z.string().trim().min(2).max(160).optional(),
  targetScore: z.string().trim().max(120).optional(),
  dailyStudyMins: z.number().int().min(30).max(720).optional(),
  preparationStart: dateSchema.optional(),
  focusSubjectIds: z.array(z.string().min(1).max(100)).max(20).transform((ids) => [...new Set(ids)]).optional(),
}).strict();
export const planSchema = z.object({ requestKey: z.uuid(), title: z.string().trim().min(2).max(120),
  previewToken: z.string().regex(/^[a-f0-9]{64}$/), startDate: dateSchema.optional() }).strict();
export const timezoneSchema = z.string().min(1).max(100).refine(value => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }, "Choose a valid timezone");
export const taskSchema = z.object({
  id: z.string().min(1), version: z.number().int().nonnegative(),
  status: z.enum(["TODO", "COMPLETED", "SKIPPED"]).optional(), dueDate: dateSchema.optional(), minutes: z.number().int().min(5).max(120).optional(), timezone: timezoneSchema.optional(),
}).strict().refine((value) => value.status !== undefined || value.dueDate !== undefined || value.minutes !== undefined);
export const sessionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), requestKey: z.uuid(), topic: z.string().trim().min(2).max(120), taskId: z.string().min(1).max(100).optional() }).strict(),
  z.object({ action: z.literal("stop"), id: z.string().min(1) }).strict(),
]);
export const plannedTaskSchema = z.object({ requestKey: z.uuid(), kind: z.enum(["LESSON", "PRACTICE"]), resourceId: z.string().min(1).max(100),
  dueDate: dateSchema, minutes: z.number().int().min(5).max(120), timezone: timezoneSchema }).strict();
export const learningProgressSchema = z.object({
  lessonId: z.string().min(1), bookmarked: z.boolean().optional(), completed: z.boolean().optional(),
}).strict().refine((value) => value.bookmarked !== undefined || value.completed !== undefined);
