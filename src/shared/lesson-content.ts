import { z } from "zod";

export const lessonSectionKinds = ["OBJECTIVE", "CONCEPT", "EXAMPLE", "CHECK", "SUMMARY"] as const;
export const lessonBodySchema = z.object({
  version: z.literal(1),
  sourceNote: z.string().trim().min(8).max(1000),
  sections: z.array(z.object({ kind: z.enum(lessonSectionKinds), title: z.string().trim().min(2).max(160), text: z.string().trim().min(10).max(5000) }).strict()).min(1).max(24),
}).strict();
export type LessonBody = z.infer<typeof lessonBodySchema>;
export function isTeachingBody(value: unknown): value is LessonBody {
  const parsed = lessonBodySchema.safeParse(value);
  return parsed.success && lessonSectionKinds.every(kind => parsed.data.sections.some(section => section.kind === kind));
}
