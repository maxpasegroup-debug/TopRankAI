import { z } from "zod";
import { lessonBodySchema } from "@/shared/lesson-content";
import { safeResourceUrl } from "./resource-url";

export const editorialEntitySchema = z.enum(["EXAM", "SUBJECT", "EXAM_SUBJECT", "CHAPTER", "LESSON", "RESOURCE"]);
export type EditorialEntity = z.infer<typeof editorialEntitySchema>;
const id = z.string().trim().min(1).max(100);
const slug = z.string().trim().min(2).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const title = z.string().trim().min(3).max(160);
const code = z.string().trim().min(2).max(40).regex(/^[A-Z0-9_]+$/);
const order = z.number().int().min(0).max(10000);
const summary = z.string().trim().max(2000);
const url = z.string().max(1000).refine(value => !value || Boolean(safeResourceUrl(value)), "A credential-free HTTPS URL is required");
const common = { id: id.optional(), revision: z.number().int().min(0).optional() };
export const draftRecordSchema = z.discriminatedUnion("entity", [
  z.object({ ...common, entity: z.literal("EXAM"), code, name: title, category: z.enum(["ENGINEERING", "MEDICAL", "OTHER"]), description: summary, officialUrl: url }).strict(),
  z.object({ ...common, entity: z.literal("SUBJECT"), code, name: title, slug }).strict(),
  z.object({ ...common, entity: z.literal("EXAM_SUBJECT"), examId: id, subjectId: id, order }).strict(),
  z.object({ ...common, entity: z.literal("CHAPTER"), subjectId: id, title, slug, summary, order }).strict(),
  z.object({ ...common, entity: z.literal("LESSON"), chapterId: id, title, slug, summary, order, body: lessonBodySchema }).strict(),
  z.object({ ...common, entity: z.literal("RESOURCE"), lessonId: id, title, slug, type: z.enum(["VIDEO", "ARTICLE", "PDF", "NOTES", "EXTERNAL", "OTHER"]), url, reference: summary, order }).strict(),
]).superRefine((value, ctx) => {
  if (value.id && value.revision === undefined) ctx.addIssue({ code: "custom", path: ["revision"], message: "The current revision is required for edits" });
  if (!value.id && value.revision !== undefined) ctx.addIssue({ code: "custom", path: ["revision"], message: "New records cannot supply a revision" });
  if (value.entity === "RESOURCE" && !value.url && !value.reference) ctx.addIssue({ code: "custom", path: ["reference"], message: "Provide a resource URL or inline reference" });
});
export type DraftRecord = z.infer<typeof draftRecordSchema>;
export const reviewContentSchema = z.object({ entity: editorialEntitySchema, id, revision: z.number().int().positive(),
  evidence: z.string().trim().min(8).max(1000), accuracyConfirmed: z.literal(true), rightsConfirmed: z.literal(true) }).strict();
export const contentImportSchema = z.object({ version: z.literal(1), records: z.array(z.object({ key: slug, draft: draftRecordSchema }).strict()).min(1).max(60) }).strict()
  .superRefine((value, ctx) => {
    const keys = new Set<string>();
    value.records.forEach((record, index) => {
      if (keys.has(record.key)) ctx.addIssue({ code: "custom", path: ["records", index, "key"], message: "Duplicate import key" });
      keys.add(record.key);
      if (record.draft.id) ctx.addIssue({ code: "custom", path: ["records", index], message: "Imports create drafts only; edit existing records separately" });
    });
  });
