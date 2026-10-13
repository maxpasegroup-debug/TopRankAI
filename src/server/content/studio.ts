import { Prisma, type ContentSource } from "@/generated/prisma/client";
import { prisma } from "@/server/db";
import type { AuthUser } from "@/server/auth/session";
import { assertPlatformAdmin } from "@/server/operations/service";
import { ConflictApiError, ValidationApiError } from "@/server/api/errors";
import { configuredKnowledgeAdapter } from "@/server/sia/knowledge-adapter";
import { assertReviewedPublication, editorialFingerprint, readEditorialRecord } from "./editorial";
import { studioMutationSchema, type StudioMutation } from "./studio-validation";
type Tx = Prisma.TransactionClient;
function knowledgeFingerprint(source: ContentSource) {
  return editorialFingerprint({ content: source.contentFingerprint, title: source.title, url: source.url, rightsHolder: source.rightsHolder,
    origin: source.origin, licence: source.licence, attribution: source.attribution, permissionEvidence: source.permissionEvidence,
    reviewerId: source.reviewerId, reviewedAt: source.reviewedAt?.toISOString() });
}
async function currentSource(tx: Tx, id: string, expectedUpdatedAt?: string) {
  const source = await tx.contentSource.findUnique({ where: { id } });
  if (!source) throw new ValidationApiError("Source was not found");
  if (expectedUpdatedAt && source.updatedAt.toISOString() !== expectedUpdatedAt) throw new ConflictApiError("Source changed. Reload before saving.");
  return source;
}
async function eligibleLesson(tx: Tx, source: ContentSource) {
  if (source.entity !== "LESSON") throw new ValidationApiError("Knowledge ingestion currently supports reviewed lessons only");
  if (!source.reviewerId || source.reviewerId === source.authorId || !source.reviewedAt) throw new ValidationApiError("Independent source and licence verification is required");
  const record = await readEditorialRecord(tx, "LESSON", source.entityId);
  if (!record || editorialFingerprint(record) !== source.contentFingerprint) throw new ValidationApiError("Content changed. Verify its source again.");
  const published = { status: "PUBLISHED" as const, active: true };
  if (!await tx.lesson.findFirst({ where: { id: source.entityId, ...published, chapter: { ...published, subject: published } } })) throw new ValidationApiError("An available published lesson is required");
  await assertReviewedPublication(tx, "LESSON", source.entityId);
}
async function audit(tx: Tx, user: AuthUser, entity: string, entityId: string, action: string, detail: unknown) {
  await tx.auditEvent.create({ data: { actorId: user.id, entity, entityId, action, detail: JSON.stringify(detail) } });
}
export async function mutateStudio(user: AuthUser, raw: StudioMutation) {
  assertPlatformAdmin(user); const input = studioMutationSchema.parse(raw);
  try { return await prisma.$transaction(async tx => {
    if (input.action === "CREATE_SYLLABUS") {
      const { action: _, effectiveFrom, ...fields } = input;
      if (!await tx.exam.findUnique({ where: { id: input.examId }, select: { id: true } })) throw new ValidationApiError("Exam was not found");
      if (input.supersedesId) {
        const previous = await tx.syllabusVersion.findUnique({ where: { id: input.supersedesId } });
        if (!previous || previous.examId !== input.examId || !["PUBLISHED", "RETIRED"].includes(previous.state)) throw new ValidationApiError("Superseded version must belong to this exam and have been published");
      }
      for (const subject of input.outline) {
        if (!await tx.examSubject.findUnique({ where: { examId_subjectId: { examId: input.examId, subjectId: subject.subjectId } } })) throw new ValidationApiError("Subject is not associated with this exam");
        for (const chapter of subject.chapters) if (!await tx.chapter.findFirst({ where: { id: chapter.chapterId, subjectId: subject.subjectId } })) throw new ValidationApiError("Chapter is not associated with this subject");
      }
      const row = await tx.syllabusVersion.create({ data: { ...fields, effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : null, authorId: user.id } });
      await audit(tx, user, "SYLLABUS", row.id, "STUDIO_SYLLABUS_CREATED", { examId: input.examId, label: input.label }); return row;
    }
    if (input.action === "SYLLABUS_DECISION") {
      const row = await tx.syllabusVersion.findUnique({ where: { id: input.id } });
      if (!row || row.state !== input.expectedState) throw new ConflictApiError("Version changed. Reload before deciding.");
      const transitions: Record<string, { from: string[]; to: string }> = {
        SUBMIT: { from: ["DRAFT"], to: "PENDING_REVIEW" }, APPROVE: { from: ["PENDING_REVIEW"], to: "APPROVED" },
        REQUEST_CHANGES: { from: ["PENDING_REVIEW"], to: "CHANGES_REQUESTED" }, PUBLISH: { from: ["APPROVED"], to: "PUBLISHED" }, RETIRE: { from: ["PUBLISHED"], to: "RETIRED" },
      };
      const transition = transitions[input.decision];
      if (!transition.from.includes(row.state)) throw new ValidationApiError("This decision is not available in the current state");
      const review = ["APPROVE", "REQUEST_CHANGES"].includes(input.decision);
      if (review && row.authorId === user.id) throw new ValidationApiError("A different reviewer must decide this version");
      if (input.decision === "PUBLISH") {
        if (!row.reviewerId || row.reviewerId === row.authorId || !row.reviewedAt) throw new ValidationApiError("Independent syllabus review is required");
        if (!await tx.exam.findFirst({ where: { id: row.examId, status: "PUBLISHED", active: true } })) throw new ValidationApiError("Publish the exam first");
      }
      const updated = await tx.syllabusVersion.update({ where: { id: row.id }, data: { state: transition.to, ...(review ? { reviewerId: user.id, reviewedAt: new Date() } : {}), decision: input.evidence } });
      await audit(tx, user, "SYLLABUS", row.id, "STUDIO_SYLLABUS_DECISION", { decision: input.decision, evidence: input.evidence }); return updated;
    }
    if (input.action === "SAVE_SOURCE") {
      const record = await readEditorialRecord(tx, input.entity, input.entityId);
      if (!record) throw new ValidationApiError("Content was not found");
      const where = { entity_entityId: { entity: input.entity, entityId: input.entityId } };
      const previous = await tx.contentSource.findUnique({ where });
      if (previous && previous.updatedAt.toISOString() !== input.expectedUpdatedAt) throw new ConflictApiError("Source changed. Reload before saving.");
      if (!previous && input.expectedUpdatedAt) throw new ConflictApiError("Source was not found. Reload before saving.");
      const { action: _, expectedUpdatedAt: __, ...fields } = input;
      const data = { ...fields, url: fields.url ?? null, authorId: user.id, reviewerId: null, reviewedAt: null, contentFingerprint: editorialFingerprint(record), siaIncluded: false };
      const row = await tx.contentSource.upsert({ where, create: data, update: data });
      await tx.contentKnowledgeJob.updateMany({ where: { sourceId: row.id, state: { not: "STALE" } }, data: { state: "STALE", reason: "Source or licence changed; refresh required" } });
      await audit(tx, user, "CONTENT_SOURCE", row.id, "STUDIO_SOURCE_SAVED", { entity: row.entity, entityId: row.entityId }); return row;
    }
    const source = await currentSource(tx, input.id, input.action === "SIA_REFRESH" ? undefined : input.expectedUpdatedAt);
    if (input.action === "VERIFY_SOURCE") {
      if (source.authorId === user.id) throw new ValidationApiError("A different reviewer must verify the source and licence");
      const record = await readEditorialRecord(tx, source.entity as Parameters<typeof readEditorialRecord>[1], source.entityId);
      if (!record || source.contentFingerprint !== editorialFingerprint(record)) throw new ValidationApiError("Content changed. Save its source again.");
      const row = await tx.contentSource.update({ where: { id: source.id }, data: { reviewerId: user.id, reviewedAt: new Date() } });
      await audit(tx, user, "CONTENT_SOURCE", row.id, "STUDIO_SOURCE_VERIFIED", { evidence: input.evidence }); return row;
    }
    if (input.action === "SIA_INCLUDE") {
      if (input.included) await eligibleLesson(tx, source);
      const row = await tx.contentSource.update({ where: { id: source.id }, data: { siaIncluded: input.included } });
      if (!input.included) await tx.contentKnowledgeJob.updateMany({ where: { sourceId: source.id }, data: { state: "STALE", reason: "Source excluded" } });
      await audit(tx, user, "CONTENT_SOURCE", row.id, "STUDIO_SIA_INCLUSION", { included: input.included }); return row;
    }
    if (!source.siaIncluded) throw new ValidationApiError("Include an eligible source before requesting a refresh");
    await eligibleLesson(tx, source);
    const fingerprint = knowledgeFingerprint(source);
    const existing = await tx.contentKnowledgeJob.findUnique({ where: { sourceId_fingerprint: { sourceId: source.id, fingerprint } } });
    if (existing && !["FAILED", "STALE"].includes(existing.state)) return existing;
    const reason = configuredKnowledgeAdapter() ? "Ingestion worker is not enabled" : "No knowledge ingestion provider or worker configured";
    const data = { state: "BLOCKED", reason, requestedById: user.id, completedAt: null };
    const job = existing ? await tx.contentKnowledgeJob.update({ where: { id: existing.id }, data }) : await tx.contentKnowledgeJob.create({ data: { sourceId: source.id, fingerprint, ...data } });
    await audit(tx, user, "KNOWLEDGE_JOB", job.id, "STUDIO_SIA_REFRESH_REQUESTED", { state: job.state }); return job;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
  catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) throw new ConflictApiError("Studio data changed. Reload before retrying."); throw error; }
}
export async function getStudioOverview(user: AuthUser) {
  assertPlatformAdmin(user);
  const [exams, versions, sources, jobs, activity] = await Promise.all([
    prisma.exam.findMany({ take: 101, orderBy: { code: "asc" }, select: { id: true, code: true, name: true, status: true } }),
    prisma.syllabusVersion.findMany({ take: 51, orderBy: { createdAt: "desc" }, include: { exam: { select: { name: true, code: true } } } }),
    prisma.contentSource.findMany({ take: 51, orderBy: { updatedAt: "desc" } }),
    prisma.contentKnowledgeJob.findMany({ take: 51, orderBy: { updatedAt: "desc" }, include: { source: { select: { title: true, siaIncluded: true } } } }),
    prisma.auditEvent.findMany({ where: { OR: [{ action: { startsWith: "STUDIO_" } }, { action: { startsWith: "CONTENT_" } }, { entity: { in: ["EXAM", "SUBJECT", "CHAPTER", "LESSON", "RESOURCE", "QUESTION", "QUESTION_EXAM"] } }] }, take: 51, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, actorId: true, entity: true, entityId: true, action: true, createdAt: true } }),
  ]);
  const eligibility = await Promise.all(sources.slice(0, 50).map(async source => {
    try { await eligibleLesson(prisma, source); return { ...source, eligible: true, eligibilityReason: null }; }
    catch (error) { if (!(error instanceof ValidationApiError)) throw error; return { ...source, eligible: false, eligibilityReason: error.message }; }
  }));
  return { providerConnected: false, ingestionWorkerEnabled: false, lastSuccessfulUpdate: null, exams: exams.slice(0, 100), versions: versions.slice(0, 50), sources: eligibility,
    jobs: jobs.slice(0, 50).map(job => { const source = eligibility.find(source => source.id === job.sourceId);
      const stale = source && (!source.eligible || !source.siaIncluded || knowledgeFingerprint(source) !== job.fingerprint);
      return { ...job, effectiveState: stale ? "STALE" : job.state, currentEligibilityChecked: Boolean(source) }; }), activity: activity.slice(0, 50),
    truncated: exams.length > 100 || [versions, sources, jobs, activity].some(rows => rows.length > 50) };
}
