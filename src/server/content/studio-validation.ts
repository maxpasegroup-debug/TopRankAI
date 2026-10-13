import { z } from "zod";
import { editorialEntitySchema } from "./authoring-validation";
import { safeResourceUrl } from "./resource-url";
const id = z.string().trim().min(1).max(100);
const evidence = z.string().trim().min(8).max(1000);
const url = z.string().max(1000).refine(value => Boolean(safeResourceUrl(value)), "A credential-free HTTPS URL is required");
export const syllabusOutlineSchema = z.array(z.object({ subjectId: id, chapters: z.array(z.object({ chapterId: id,
  topics: z.array(z.object({ title: z.string().trim().min(3).max(160), objectives: z.array(z.string().trim().min(3).max(500)).min(1).max(12) }).strict()).min(1).max(40),
}).strict()).min(1).max(40) }).strict()).min(1).max(12).superRefine((outline, ctx) => {
  const subjects = new Set<string>(); const chapters = new Set<string>();
  for (const subject of outline) { if (subjects.has(subject.subjectId)) ctx.addIssue({ code: "custom", message: "Duplicate subject" }); subjects.add(subject.subjectId);
    for (const chapter of subject.chapters) { if (chapters.has(chapter.chapterId)) ctx.addIssue({ code: "custom", message: "Duplicate chapter" }); chapters.add(chapter.chapterId);
      if (new Set(chapter.topics.map(topic => topic.title.toLowerCase())).size !== chapter.topics.length) ctx.addIssue({ code: "custom", message: "Duplicate topic" }); }
  }
});
export const studioMutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CREATE_SYLLABUS"), examId: id, label: z.string().trim().min(2).max(80), sourceUrl: url, evidence,
    effectiveFrom: z.iso.datetime().optional(), supersedesId: id.optional(), outline: syllabusOutlineSchema }).strict(),
  z.object({ action: z.literal("SYLLABUS_DECISION"), id, expectedState: z.enum(["DRAFT", "PENDING_REVIEW", "CHANGES_REQUESTED", "APPROVED", "PUBLISHED"]),
    decision: z.enum(["SUBMIT", "APPROVE", "REQUEST_CHANGES", "PUBLISH", "RETIRE"]), evidence }).strict(),
  z.object({ action: z.literal("SAVE_SOURCE"), entity: editorialEntitySchema, entityId: id, expectedUpdatedAt: z.iso.datetime().optional(), title: z.string().trim().min(3).max(160),
    url: url.optional(), rightsHolder: z.string().trim().min(3).max(250), origin: z.enum(["ORIGINAL", "LICENSED", "PUBLIC_REFERENCE", "AI_ASSISTED"]),
    licence: z.string().trim().min(3).max(250), attribution: z.string().trim().max(1000), permissionEvidence: evidence }).strict(),
  z.object({ action: z.literal("VERIFY_SOURCE"), id, expectedUpdatedAt: z.iso.datetime(), evidence }).strict(),
  z.object({ action: z.literal("SIA_INCLUDE"), id, expectedUpdatedAt: z.iso.datetime(), included: z.boolean() }).strict(),
  z.object({ action: z.literal("SIA_REFRESH"), id }).strict(),
]);
export type StudioMutation = z.infer<typeof studioMutationSchema>;
