import { z } from "zod";
import { contentImportSchema, draftRecordSchema, type DraftRecord } from "./authoring-validation";
import { editorialFingerprint } from "./editorial";
import { ValidationApiError } from "@/server/api/errors";
const envelope = z.object({ version: z.literal(1), records: z.array(z.object({ key: z.string().max(160), draft: z.unknown() }).strict()).min(1).max(60) }).strict();
export const confirmedContentImportSchema = z.object({ pack: contentImportSchema, previewFingerprint: z.string().regex(/^[a-f0-9]{64}$/), confirmed: z.literal(true) }).strict();
function identity(draft: DraftRecord) {
  switch (draft.entity) {
    case "EXAM": return `EXAM:${draft.code}`;
    case "SUBJECT": return `SUBJECT:${draft.code}:${draft.slug}`;
    case "EXAM_SUBJECT": return `EXAM_SUBJECT:${draft.examId}:${draft.subjectId}`;
    case "CHAPTER": return `CHAPTER:${draft.subjectId}:${draft.slug}`;
    case "LESSON": return `LESSON:${draft.chapterId}:${draft.slug}`;
    case "RESOURCE": return `RESOURCE:${draft.lessonId}:${draft.slug}`;
  }
}
export function previewContentImport(input: unknown) {
  const pack = envelope.safeParse(input);
  if (!pack.success) return { valid: false, fingerprint: null, rows: [], errors: ["Expected version 1 and between 1 and 60 keyed draft records"], databaseDuplicatesChecked: false };
  const refs = new Map<string, string>(); const identities = new Set<string>(); const subjects = new Set<string>();
  const rows = pack.data.records.map((entry, index) => {
    const parsed = draftRecordSchema.safeParse(entry.draft); const errors: string[] = [];
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.key) || entry.key.length < 2) errors.push("Invalid import key");
    if (refs.has(entry.key)) errors.push("Duplicate import key");
    if (!parsed.success) errors.push(...parsed.error.issues.map(issue => `${issue.path.join(".") || "draft"}: ${issue.message}`));
    if (parsed.success) {
      const draft = parsed.data;
      if (draft.id) errors.push("Imports cannot overwrite existing content");
      for (const [field, expected] of Object.entries({ examId: "EXAM", subjectId: "SUBJECT", chapterId: "CHAPTER", lessonId: "LESSON" })) {
        const value = (draft as unknown as Record<string, unknown>)[field];
        if (typeof value === "string" && value.startsWith("@") && refs.get(value.slice(1)) !== expected) errors.push(`${field}: parent must reference an earlier valid record of the correct type`);
      }
      const key = identity(draft); if (identities.has(key)) errors.push("Duplicate content key"); identities.add(key);
      if (draft.entity === "SUBJECT") { for (const key of [`code:${draft.code}`, `slug:${draft.slug}`]) { if (subjects.has(key)) errors.push("Duplicate subject code or slug"); subjects.add(key); } }
      if (!errors.length) refs.set(entry.key, draft.entity);
    }
    return { row: index + 1, key: entry.key, entity: parsed.success ? parsed.data.entity : null, errors };
  });
  const valid = rows.every(row => !row.errors.length);
  return { valid, fingerprint: valid ? editorialFingerprint(contentImportSchema.parse(input)) : null, rows, errors: [], databaseDuplicatesChecked: false };
}
export function assertConfirmedImport(input: z.infer<typeof confirmedContentImportSchema>) {
  const parsed = confirmedContentImportSchema.parse(input); const preview = previewContentImport(parsed.pack);
  if (!preview.valid || preview.fingerprint !== parsed.previewFingerprint) throw new ValidationApiError("Import changed or is invalid. Preview it again before confirming.");
  return parsed.pack;
}
