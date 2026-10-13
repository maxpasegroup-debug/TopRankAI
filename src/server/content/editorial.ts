import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { ValidationApiError } from "@/server/api/errors";
import { editorialEntitySchema, type EditorialEntity } from "./authoring-validation";
import { isTeachingBody } from "@/shared/lesson-content";
import { safeResourceUrl } from "./resource-url";

export async function readEditorialRecord(tx: Prisma.TransactionClient, entity: EditorialEntity, id: string) {
  switch (entity) {
    case "EXAM": return tx.exam.findUnique({ where: { id }, select: { id: true, code: true, name: true, category: true, description: true, officialUrl: true } });
    case "SUBJECT": return tx.subject.findUnique({ where: { id }, select: { id: true, code: true, name: true, slug: true } });
    case "EXAM_SUBJECT": return tx.examSubject.findUnique({ where: { id }, select: { id: true, examId: true, subjectId: true, order: true } });
    case "CHAPTER": return tx.chapter.findUnique({ where: { id }, select: { id: true, subjectId: true, title: true, slug: true, summary: true, order: true } });
    case "LESSON": return tx.lesson.findUnique({ where: { id }, select: { id: true, chapterId: true, title: true, slug: true, summary: true, order: true, body: true } });
    case "RESOURCE": return tx.learningResource.findUnique({ where: { id }, select: { id: true, lessonId: true, title: true, slug: true, type: true, url: true, reference: true, order: true } });
  }
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)]));
  return value;
}
export function editorialFingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}
export function assertReviewable(entity: EditorialEntity, record: NonNullable<Awaited<ReturnType<typeof readEditorialRecord>>>) {
  if (entity === "LESSON" && (!("body" in record) || !isTeachingBody(record.body))) throw new ValidationApiError("A lesson needs objectives, concepts, worked examples, checks and a summary before review");
  if (entity === "RESOURCE" && "url" in record && ((!record.url && !record.reference) || (record.url && !safeResourceUrl(record.url)))) throw new ValidationApiError("Provide a safe resource or inline reference before review");
  if (entity === "EXAM" && "officialUrl" in record && record.officialUrl && !safeResourceUrl(record.officialUrl)) throw new ValidationApiError("Provide a safe official exam URL");
}
export async function assertReviewedPublication(tx: Prisma.TransactionClient, entityValue: string, id: string) {
  const entity = editorialEntitySchema.parse(entityValue);
  const record = await readEditorialRecord(tx, entity, id);
  if (!record) throw new ValidationApiError("Content was not found");
  assertReviewable(entity, record);
  const review = await tx.contentEditorialRecord.findUnique({ where: { entity_entityId: { entity, entityId: id } } });
  if (!review || !review.reviewerId || review.reviewerId === review.authorId || review.reviewedRevision !== review.revision ||
      !review.reviewedAt || !review.reviewEvidence || review.reviewedFingerprint !== editorialFingerprint(record)) {
    throw new ValidationApiError("Save this content as a draft and obtain an independent review of its current revision before publishing");
  }
  const source = await tx.contentSource.findUnique({ where: { entity_entityId: { entity, entityId: id } } });
  if (!source || !source.reviewerId || source.reviewerId === source.authorId || !source.reviewedAt ||
      source.contentFingerprint !== editorialFingerprint(record) || !source.licence || !source.rightsHolder || !source.permissionEvidence) {
    throw new ValidationApiError("Independent verification of the current source and licence is required before publishing");
  }
  const published = { status: "PUBLISHED" as const, active: true };
  let parentReady = true;
  if ("subjectId" in record && entity === "CHAPTER") parentReady = Boolean(await tx.subject.findFirst({ where: { id: record.subjectId, ...published } }));
  if ("examId" in record) parentReady = Boolean(await tx.exam.findFirst({ where: { id: record.examId, ...published } })) && Boolean(await tx.subject.findFirst({ where: { id: record.subjectId, ...published } }));
  if ("chapterId" in record) parentReady = Boolean(await tx.chapter.findFirst({ where: { id: record.chapterId, ...published, subject: published } }));
  if ("lessonId" in record) parentReady = Boolean(await tx.lesson.findFirst({ where: { id: record.lessonId, ...published, chapter: { ...published, subject: published } } }));
  if (!parentReady) throw new ValidationApiError("Publish the active parent content first");
}
