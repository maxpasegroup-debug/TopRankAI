import { z } from "zod";
import { decimalPattern } from "@/server/practice/scoring";
export const idSchema = z.string().min(1).max(100);
const marking = z.string().regex(/^\d{1,3}(?:\.\d{1,2})?$/);
export const sectionSchema = z.object({ title: z.string().trim().min(1).max(100),
 questionCount: z.number().int().min(1).max(100), questionIds: z.array(idSchema).min(1).max(100),
 marks: marking.refine((v) => Number(v) > 0), negativeMarks: marking,
 unansweredMarks: z.string().regex(/^-?\d{1,3}(?:\.\d{1,2})?$/).refine((v) => Number(v) <= 0),
}).strict().refine((s) => s.questionCount === s.questionIds.length, "Question count must match the selection");
export const blueprintSchema = z.object({ examId: idSchema, title: z.string().trim().min(3).max(160),
 durationSeconds: z.number().int().min(60).max(21600), maxAttempts: z.number().int().min(1).max(10),
 revealPolicy: z.enum(["AFTER_SUBMISSION", "NEVER"]), sections: z.array(sectionSchema).min(1).max(10),
}).strict().refine((b) => { const ids = b.sections.flatMap((s) => s.questionIds);
 return ids.length <= 200 && new Set(ids).size === ids.length; }, "Choose at most 200 unique questions");
export const adminMockSchema = z.discriminatedUnion("action", [
 z.object({ action: z.literal("create"), blueprint: blueprintSchema }).strict(),
 z.object({ action: z.literal("edit"), id: idSchema, version: z.number().int().nonnegative(), blueprint: blueprintSchema }).strict(),
 z.object({ action: z.enum(["validate", "publish", "unpublish"]), id: idSchema, version: z.number().int().nonnegative() }).strict(),
 z.object({ action: z.literal("review"), id: idSchema, version: z.number().int().nonnegative(), evidence: z.string().trim().min(8).max(1000) }).strict(),
]);
export const answerSchema = z.object({ optionIds: z.array(idSchema).min(1).max(50).optional(),
 numerical: z.string().max(60).regex(decimalPattern).optional() }).strict()
 .refine((a) => !(a.optionIds && a.numerical !== undefined), "Use one answer format");
export const mockMutationSchema = z.discriminatedUnion("action", [
 z.object({ action: z.literal("start"), mockId: idSchema, requestKey: z.uuid() }).strict(),
 z.object({ action: z.literal("save"), attemptId: idSchema, position: z.number().int().min(0).max(199),
 version: z.number().int().nonnegative(), answer: answerSchema, flagged: z.boolean(), bookmarked: z.boolean() }).strict(),
 z.object({ action: z.literal("submit"), attemptId: idSchema }).strict(),
]);
export const revisionSchema = z.object({ attemptId: idSchema, position: z.number().int().min(0).max(199),
 action: z.enum(["reviewed", "bookmark", "mission"]), bookmarked: z.boolean().optional() }).strict()
 .refine((v) => v.action !== "bookmark" || v.bookmarked !== undefined);
export type Blueprint = z.infer<typeof blueprintSchema>;
export type Answer = z.infer<typeof answerSchema>;
