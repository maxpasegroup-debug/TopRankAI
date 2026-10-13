import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db";
import type { AuthUser } from "@/server/auth/session";
import { assertPlatformAdmin } from "@/server/operations/service";
import { ConflictApiError, ValidationApiError } from "@/server/api/errors";
import { contentImportSchema, draftRecordSchema, reviewContentSchema, type DraftRecord, type EditorialEntity } from "./authoring-validation";
import { assertReviewable, editorialFingerprint, readEditorialRecord } from "./editorial";

async function transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
  try { return await prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
  catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) throw new ConflictApiError("Content changed or its key already exists. Reload before saving.");
    throw error;
  }
}
async function writeDraft(tx: Prisma.TransactionClient, user: AuthUser, input: DraftRecord) {
  const { entity, id, revision } = input;
  const previous = id ? await readEditorialRecord(tx, entity, id) : null;
  if (id && !previous) throw new ValidationApiError("Content was not found");
  const current = id ? await tx.contentEditorialRecord.findUnique({ where: { entity_entityId: { entity, entityId: id } } }) : null;
  if (id && revision !== (current?.revision ?? 0)) throw new ConflictApiError("This revision changed. Reload before saving.");
  let immutable = Boolean(current?.reviewedAt && current.reviewedRevision === current.revision);
  if (id) {
    const status = await (async () => {
      switch (entity) {
        case "EXAM": return tx.exam.findUnique({ where: { id }, select: { status: true } });
        case "SUBJECT": return tx.subject.findUnique({ where: { id }, select: { status: true } });
        case "EXAM_SUBJECT": return tx.examSubject.findUnique({ where: { id }, select: { status: true } });
        case "CHAPTER": return tx.chapter.findUnique({ where: { id }, select: { status: true } });
        case "LESSON": return tx.lesson.findUnique({ where: { id }, select: { status: true } });
        case "RESOURCE": return tx.learningResource.findUnique({ where: { id }, select: { status: true } });
      }
    })();
    immutable = immutable || status?.status === "PUBLISHED";
  }
  const properties: Record<string, unknown> = { ...input };
  const oldProperties: Record<string, unknown> = { ...previous };
  for (const [key, parentEntity] of Object.entries({ subjectId: "SUBJECT", chapterId: "CHAPTER", lessonId: "LESSON", examId: "EXAM" })) {
    const parentId = properties[key];
    if (typeof parentId !== "string") continue;
    if (previous && key in previous && oldProperties[key] !== parentId) throw new ValidationApiError("Existing content cannot be moved to a different parent");
    if (!await readEditorialRecord(tx, parentEntity as EditorialEntity, parentId)) throw new ValidationApiError("Parent content was not found");
  }
  if (immutable) throw new ConflictApiError("Reviewed or published content is immutable in this authoring increment. Create a new draft instead.");
  const base = { status: "DRAFT" as const, active: true };
  let saved: { id: string };
  switch (input.entity) {
    case "EXAM": { const data = { ...base, code: input.code, name: input.name, category: input.category, description: input.description, officialUrl: input.officialUrl || null }; saved = id ? await tx.exam.update({ where: { id }, data }) : await tx.exam.create({ data }); break; }
    case "SUBJECT": { const data = { ...base, code: input.code, name: input.name, slug: input.slug }; saved = id ? await tx.subject.update({ where: { id }, data }) : await tx.subject.create({ data }); break; }
    case "EXAM_SUBJECT": { const data = { ...base, examId: input.examId, subjectId: input.subjectId, order: input.order }; saved = id ? await tx.examSubject.update({ where: { id }, data }) : await tx.examSubject.create({ data }); break; }
    case "CHAPTER": { const data = { ...base, subjectId: input.subjectId, title: input.title, slug: input.slug, summary: input.summary, order: input.order }; saved = id ? await tx.chapter.update({ where: { id }, data }) : await tx.chapter.create({ data }); break; }
    case "LESSON": { const data = { ...base, chapterId: input.chapterId, title: input.title, slug: input.slug, summary: input.summary, order: input.order, body: input.body }; saved = id ? await tx.lesson.update({ where: { id }, data }) : await tx.lesson.create({ data }); break; }
    case "RESOURCE": { const data = { ...base, lessonId: input.lessonId, title: input.title, slug: input.slug, type: input.type, url: input.url || null, reference: input.reference || null, order: input.order }; saved = id ? await tx.learningResource.update({ where: { id }, data }) : await tx.learningResource.create({ data }); break; }
  }
  const reset = { authorId: user.id, reviewerId: null, reviewedRevision: null, reviewedFingerprint: null, reviewEvidence: null, reviewedAt: null };
  const editorial = await tx.contentEditorialRecord.upsert({ where: { entity_entityId: { entity, entityId: saved.id } },
    create: { entity, entityId: saved.id, revision: 1, ...reset }, update: { revision: { increment: 1 }, ...reset } });
  await tx.auditEvent.create({ data: { actorId: user.id, entity, entityId: saved.id, action: "CONTENT_DRAFT_SAVED", detail: JSON.stringify({ revision: editorial.revision }) } });
  return { id: saved.id, revision: editorial.revision, entity };
}
export async function saveContentDraft(user: AuthUser, input: z.infer<typeof draftRecordSchema>) {
  assertPlatformAdmin(user);
  return transaction(tx => writeDraft(tx, user, draftRecordSchema.parse(input)));
}
export async function reviewContent(user: AuthUser, input: z.infer<typeof reviewContentSchema>) {
  assertPlatformAdmin(user);
  input = reviewContentSchema.parse(input);
  return transaction(async tx => {
    const where = { entity_entityId: { entity: input.entity, entityId: input.id } };
    const editorial = await tx.contentEditorialRecord.findUnique({ where });
    if (!editorial || editorial.revision !== input.revision) throw new ConflictApiError("Save and reload the current draft before review");
    if (editorial.authorId === user.id) throw new ValidationApiError("A different reviewer must review this revision");
    const record = await readEditorialRecord(tx, input.entity, input.id);
    if (!record) throw new ValidationApiError("Content was not found");
    assertReviewable(input.entity, record);
    const claimed = await tx.contentEditorialRecord.updateMany({ where: { entity: input.entity, entityId: input.id, revision: input.revision },
      data: { reviewerId: user.id, reviewedRevision: input.revision, reviewedFingerprint: editorialFingerprint(record), reviewEvidence: input.evidence, reviewedAt: new Date() } });
    if (claimed.count !== 1) throw new ConflictApiError("This revision changed. Reload before review.");
    await tx.auditEvent.create({ data: { actorId: user.id, entity: input.entity, entityId: input.id, action: "CONTENT_REVIEWED", detail: JSON.stringify({ revision: input.revision, fingerprint: editorialFingerprint(record), evidence: input.evidence }) } });
    return { id: input.id, revision: input.revision };
  });
}
export async function importContentDrafts(user: AuthUser, input: z.infer<typeof contentImportSchema>) {
  assertPlatformAdmin(user);
  const pack = contentImportSchema.parse(input);
  return transaction(async tx => {
    const refs = new Map<string, { id: string; entity: EditorialEntity }>();
    const results = [];
    for (const entry of pack.records) {
      const raw: Record<string, unknown> = { ...entry.draft };
      for (const [field, expected] of Object.entries({ examId: "EXAM", subjectId: "SUBJECT", chapterId: "CHAPTER", lessonId: "LESSON" })) {
        const value = raw[field];
        if (typeof value === "string" && value.startsWith("@")) {
          const ref = refs.get(value.slice(1));
          if (!ref || ref.entity !== expected) throw new ValidationApiError("Import parents must reference an earlier record of the correct type");
          raw[field] = ref.id;
        }
      }
      const saved = await writeDraft(tx, user, draftRecordSchema.parse(raw));
      refs.set(entry.key, saved); results.push({ key: entry.key, ...saved });
    }
    await tx.auditEvent.create({ data: { actorId: user.id, entity: "CONTENT_IMPORT", entityId: editorialFingerprint(pack), action: "CONTENT_IMPORT_COMPLETED", detail: JSON.stringify({ imported: results.length, records: results }) } });
    return { imported: results.length, records: results };
  });
}
export async function listEditorialContent(user: AuthUser, entity: EditorialEntity, cursor?: string) {
  assertPlatformAdmin(user);
  const options = { take: 51, orderBy: { id: "asc" as const }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) };
  const rows = await (async () => {
    switch (entity) {
      case "EXAM": return prisma.exam.findMany(options);
      case "SUBJECT": return prisma.subject.findMany(options);
      case "EXAM_SUBJECT": return prisma.examSubject.findMany(options);
      case "CHAPTER": return prisma.chapter.findMany(options);
      case "LESSON": return prisma.lesson.findMany(options);
      case "RESOURCE": return prisma.learningResource.findMany(options);
    }
  })();
  const page = rows.slice(0, 50);
  const reviews = await prisma.contentEditorialRecord.findMany({ where: { entity, entityId: { in: page.map(row => row.id) } } });
  return { records: page.map(row => ({ ...row, editorial: reviews.find(review => review.entityId === row.id) ?? null })), nextCursor: rows.length > 50 ? page.at(-1)!.id : null };
}
