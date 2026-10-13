import { Prisma } from "@/generated/prisma/client";
import type { AuthUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { assertStudent } from "@/server/student/service";
import { assertPlatformAdmin } from "@/server/operations/service";
import { ConflictApiError, ValidationApiError } from "@/server/api/errors";
import { scoreAnswer } from "@/server/practice/scoring";
import { blueprintSchema, mockMutationSchema, adminMockSchema, revisionSchema, idSchema, type Blueprint } from "./validation";
import { calculateResult, isAnswered, publicQuestion, publicResult, type Snapshot, type SavedAnswer, type Result } from "./engine";
import type { z } from "zod";
import { requireWindow } from "@/server/competition/rules";
import { requireResourceAccess } from "@/server/commerce/access";
import { nextRevisionDate } from "@/server/journey/schedule";
import { editorialFingerprint } from "@/server/content/editorial";

type Tx = Prisma.TransactionClient;
type Attempt = Prisma.MockAttemptGetPayload<{ include: { answers: true } }>;
const published = { status: "PUBLISHED" as const, active: true };
const includeAnswers = { answers: { orderBy: { position: "asc" as const } } };
const absent = () => new ValidationApiError("Mock exam or attempt was not found");
// Retries are bounded; the partial unique index also protects starts across processes.
async function atomic<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
 for (let retry = 0; retry < 3; retry++) {
   try { return await prisma.$transaction(work, { isolationLevel: "Serializable" }); }
   catch (error) {
     if (!(error instanceof Prisma.PrismaClientKnownRequestError) || !["P2002", "P2034"].includes(error.code)) throw error;
   }
 }
 throw new ConflictApiError("Concurrent update. Reload and try again.");
}
function snapshotOf(attempt: Attempt) { return attempt.snapshot as unknown as Snapshot; }
function answersOf(attempt: Attempt): SavedAnswer[] {
 return attempt.answers.map((a) => ({ position: a.position, answer: a.answer as SavedAnswer["answer"],
   version: a.version, flagged: a.flagged, bookmarked: a.bookmarked }));
}
export function attemptDto(attempt: Attempt, now = new Date()) {
 const snapshot = snapshotOf(attempt);
 return { id: attempt.id, ownerId: attempt.userId, mockId: attempt.mockExamId, title: snapshot.title, status: attempt.status,
   startedAt: attempt.startedAt.toISOString(), deadline: attempt.deadline.toISOString(), serverNow: now.toISOString(),
   finalizedAt: attempt.finalizedAt?.toISOString() ?? null, revealPolicy: snapshot.revealPolicy,
   sections: snapshot.sections.map(({ title, questionCount, marks, negativeMarks, unansweredMarks }) => ({ title, questionCount, marks, negativeMarks, unansweredMarks })),
   questions: snapshot.questions.map(publicQuestion), answers: answersOf(attempt),
   result: attempt.result ? publicResult(attempt.result as unknown as Result) : null,
   review: attempt.status !== "IN_PROGRESS" && attempt.result && snapshot.revealPolicy === "AFTER_SUBMISSION"
     ? snapshot.questions.map((q, position) => ({ explanation: q.explanation,
       ...(attempt.result as unknown as Result).outcomes[position] })) : [] };
}
async function eligible(tx: Tx, user: AuthUser) {
 const profile = await tx.studentProfile.findUnique({ where: { userId: user.id }, select: { targetExamId: true, onboardingCompletedAt: true } });
 if (!profile?.targetExamId || !profile.onboardingCompletedAt) throw new ValidationApiError("Complete student onboarding first");
 return profile.targetExamId;
}
function blueprintOf(record: { examId: string; title: string; durationSeconds: number; maxAttempts: number; revealPolicy: string; sections: Prisma.JsonValue }): Blueprint {
 return blueprintSchema.parse({ examId: record.examId, title: record.title, durationSeconds: record.durationSeconds,
   maxAttempts: record.maxAttempts, revealPolicy: record.revealPolicy, sections: record.sections });
}
export async function requireMockReview(tx: Tx, mock: Parameters<typeof blueprintOf>[0] & { id: string; version: number }) {
 const review = await tx.contentEditorialRecord.findUnique({ where: { entity_entityId: { entity: "MOCK_EXAM", entityId: mock.id } } });
 if (!review?.reviewerId || review.authorId === review.reviewerId || !review.reviewedAt || !review.reviewEvidence ||
   review.revision !== mock.version || review.reviewedRevision !== mock.version || review.reviewedFingerprint !== editorialFingerprint(blueprintOf(mock)))
   throw new ValidationApiError("Independent review of this blueprint version is required");
}
async function freeze(tx: Tx, blueprint: Blueprint): Promise<Snapshot> {
 const exam = await tx.exam.findFirst({ where: { id: blueprint.examId, ...published }, select: { id: true } });
 if (!exam) throw new ValidationApiError("Publish the target exam first");
 const ids = blueprint.sections.flatMap((s) => s.questionIds);
 const links = await tx.questionExam.findMany({ where: { examId: blueprint.examId, questionId: { in: ids }, ...published,
   question: { ...published, reviewStatus: "REVIEWED", subject: published, chapter: { ...published, subject: published },
     OR: [{ lessonId: null }, { lesson: { ...published, chapter: { ...published, subject: published } } }] } },
   include: { question: { include: { options: { where: { active: true }, orderBy: { order: "asc" } },
     subject: true, chapter: true, lesson: true } } } });
 if (links.length !== ids.length) throw new ValidationApiError("All selected questions must be reviewed, published and linked to this exam");
 const questions = blueprint.sections.flatMap((section, sectionIndex) => section.questionIds.map((id) => {
   const link = links.find((l) => l.questionId === id)!; const q = link.question;
   if (q.chapter.subjectId !== q.subjectId || (q.lesson && q.lesson.chapterId !== q.chapterId)) throw new ValidationApiError("Selected question has inconsistent content relationships");
   if (q.options.length > 50) throw new ValidationApiError("A question has too many options");
   const frozen = { id: q.id, text: q.text, type: q.type, section: sectionIndex, subject: q.subject.name,
     lessonId: q.lessonId, lessonHref: q.lesson ? `/learn/${q.subject.slug}/${q.chapter.slug}/${q.lesson.slug}` : null,
     marks: section.marks, negativeMarks: section.negativeMarks, unansweredMarks: section.unansweredMarks,
     mode: link.scoringMode, numericalAnswer: q.numericalAnswer, explanation: q.explanation,
     options: q.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })) };
   scoreAnswer(frozen, q.type === "NUMERICAL" ? { numerical: q.numericalAnswer ?? "" } : { optionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id) });
   return frozen;
 }));
 return { title: blueprint.title, revealPolicy: blueprint.revealPolicy,
   sections: blueprint.sections.map(({ title, questionCount, marks, negativeMarks, unansweredMarks }) => ({ title, questionCount, marks, negativeMarks, unansweredMarks })), questions };
}
async function ownerAttempt(tx: Tx, user: AuthUser, id: string) {
 const attempt = await tx.mockAttempt.findFirst({ where: { id, userId: user.id }, include: includeAnswers });
 if (!attempt) throw absent(); return attempt;
}
async function finalize(tx: Tx, attempt: Attempt, now: Date, manual = false): Promise<Attempt> {
 if (attempt.status !== "IN_PROGRESS" || (!manual && now < attempt.deadline)) return attempt;
 const expired = now >= attempt.deadline;
 const result = calculateResult(snapshotOf(attempt), answersOf(attempt), attempt.startedAt, attempt.deadline, now);
 const changed = await tx.mockAttempt.updateMany({ where: { id: attempt.id, userId: attempt.userId, status: "IN_PROGRESS" },
   data: { status: expired ? "EXPIRED" : "SUBMITTED", finalizedAt: expired ? attempt.deadline : now,
     result: result as unknown as Prisma.InputJsonValue } });
 if (changed.count !== 1) throw new ConflictApiError("Attempt changed. Reload and try again.");
 return { ...attempt, status: expired ? "EXPIRED" : "SUBMITTED", finalizedAt: expired ? attempt.deadline : now,
   result: result as unknown as Prisma.JsonValue };
}
// Internal transaction helper: callers must derive the attempt ID from a trusted entry.
export async function reconcileCompetitionAttempt(tx: Tx, id: string) {
 const attempt = await tx.mockAttempt.findUnique({ where: { id }, include: includeAnswers });
 if (!attempt) throw absent(); return finalize(tx, attempt, new Date());
}
export async function getMockAttempt(user: AuthUser, id: string) {
 assertStudent(user); idSchema.parse(id);
 return atomic(async (tx) => { const attempt = await ownerAttempt(tx, user, id); const now = new Date();
   return attemptDto(await finalize(tx, attempt, now), now); });
}
export async function listStudentMocks(user: AuthUser) {
 assertStudent(user);
 return atomic(async (tx) => {
   const examId = await eligible(tx, user);
   const mocks = await tx.mockExam.findMany({ where: { examId, status: "PUBLISHED", exam: published,
     OR: [{ competition: null }, { competition: { status: "CANCELLED" } }] }, orderBy: { title: "asc" }, take: 100 });
   const history = await tx.mockAttempt.findMany({ where: { userId: user.id }, orderBy: { startedAt: "desc" }, take: 50, include: includeAnswers });
   const attempts = [];
   for (const a of history) { const finalized = await finalize(tx, a, new Date()); const snap = snapshotOf(finalized);
     attempts.push({ id: a.id, mockId: a.mockExamId, title: snap.title, status: finalized.status, startedAt: a.startedAt.toISOString(),
       result: finalized.result ? publicResult(finalized.result as unknown as Result) : null }); }
   return { ownerId: user.id, mocks: mocks.map((m) => { const b = blueprintOf(m); return { id: m.id, title: m.title, durationSeconds: m.durationSeconds,
     maxAttempts: m.maxAttempts, revealPolicy: m.revealPolicy, sections: b.sections.map(({ title, questionCount, marks, negativeMarks, unansweredMarks }) => ({ title, questionCount, marks, negativeMarks, unansweredMarks })) }; }), attempts };
 });
}
export async function mutateMock(user: AuthUser, raw: z.infer<typeof mockMutationSchema>, competitionId?: string) {
 assertStudent(user); const input = mockMutationSchema.parse(raw);
 return atomic(async (tx) => {
   if (input.action === "start") {
     const previous = await tx.mockAttempt.findUnique({ where: { userId_requestKey: { userId: user.id, requestKey: input.requestKey } }, include: includeAnswers });
     if (previous) { if (previous.mockExamId !== input.mockId) throw new ConflictApiError("Request key already used");
       return attemptDto(await finalize(tx, previous, new Date())); }
     const examId = await eligible(tx, user);
     const mock = await tx.mockExam.findFirst({ where: { id: input.mockId, examId, status: "PUBLISHED", exam: published } });
     if (!mock) throw absent();
     await requireResourceAccess("MOCK", mock.id, user, tx);
     const reserved = await tx.competition.findFirst({ where: { mockExamId: mock.id, status: { not: "CANCELLED" } } });
     if (reserved) {
       if (reserved.id !== competitionId) throw new ValidationApiError("Start this reserved mock through its competition");
       requireWindow(reserved.status, reserved.startsAt, reserved.endsAt, new Date());
       if (mock.version !== reserved.mockVersion) throw new ValidationApiError("Competition blueprint changed");
     } else if (competitionId) throw absent();
     const active = await tx.mockAttempt.findFirst({ where: { userId: user.id, mockExamId: mock.id, status: "IN_PROGRESS" }, include: includeAnswers });
     let expired: Attempt | null = null;
     if (active) { const current = await finalize(tx, active, new Date()); if (current.status === "IN_PROGRESS") return attemptDto(current); expired = current; }
     const count = await tx.mockAttempt.count({ where: { userId: user.id, mockExamId: mock.id } });
     if (count >= mock.maxAttempts) { if (expired) return attemptDto(expired); throw new ValidationApiError("Attempt limit reached"); }
     await requireMockReview(tx, mock);
     const snapshot = await freeze(tx, blueprintOf(mock)); const startedAt = new Date();
     const attempt = await tx.mockAttempt.create({ data: { userId: user.id, mockExamId: mock.id, requestKey: input.requestKey,
       startedAt, deadline: new Date(startedAt.getTime() + mock.durationSeconds * 1000), snapshot: snapshot as unknown as Prisma.InputJsonValue,
       answers: { create: snapshot.questions.map((_, position) => ({ position, answer: {} })) } }, include: includeAnswers });
     return attemptDto(attempt);
   }
   const attempt = await ownerAttempt(tx, user, input.attemptId); const now = new Date();
   const current = await finalize(tx, attempt, now, input.action === "submit");
   if (input.action === "submit" || current.status !== "IN_PROGRESS") return attemptDto(current, now);
   const q = snapshotOf(attempt).questions[input.position]; const saved = attempt.answers.find((a) => a.position === input.position);
   if (!q || !saved) throw absent();
   if (isAnswered(input.answer)) {
     // Reuse validation without returning correctness to the active attempt.
     scoreAnswer(q, input.answer);
   }
   const answer = input.answer.optionIds ? { optionIds: [...input.answer.optionIds].sort() } : input.answer;
   const saveTime = new Date();
   if (saveTime >= attempt.deadline) return attemptDto(await finalize(tx, attempt, saveTime), saveTime);
   if (saved.version !== input.version) {
     if (JSON.stringify(saved.answer) === JSON.stringify(answer) && saved.flagged === input.flagged && saved.bookmarked === input.bookmarked) return attemptDto(attempt);
     throw new ConflictApiError("Answer changed in another tab. Reload before saving.");
   }
   const changed = await tx.mockAnswer.updateMany({ where: { id: saved.id, version: input.version, attempt: { userId: user.id, status: "IN_PROGRESS" } },
     data: { answer, flagged: input.flagged, bookmarked: input.bookmarked, version: { increment: 1 } } });
   if (changed.count !== 1) throw new ConflictApiError("Answer changed. Reload before saving.");
   return attemptDto(await ownerAttempt(tx, user, attempt.id));
 });
}
export async function adminMocks(user: AuthUser, examId?: string) {
 assertPlatformAdmin(user);
 if (examId !== undefined) idSchema.parse(examId);
 const mocks = await prisma.mockExam.findMany({ orderBy: { updatedAt: "desc" }, take: 100,
   select: { id: true, examId: true, title: true, status: true, version: true, durationSeconds: true, maxAttempts: true, revealPolicy: true, sections: true } });
 const exams = await prisma.exam.findMany({ where: published, take: 100, orderBy: { name: "asc" }, select: { id: true, name: true } });
 const questions = examId ? await prisma.question.findMany({ where: { ...published, reviewStatus: "REVIEWED", subject: published,
   chapter: { ...published, subject: published }, exams: { some: { examId, ...published } } },
   take: 200, orderBy: { code: "asc" }, select: { id: true, code: true, text: true, type: true } }) : [];
 const reviews = await prisma.contentEditorialRecord.findMany({ where: { entity: "MOCK_EXAM", entityId: { in: mocks.map(m => m.id) } } });
 return { mocks: mocks.map(m => { const r = reviews.find(r => r.entityId === m.id); return { ...m,
   reviewed: Boolean(r?.reviewerId && r.reviewerId !== r.authorId && r.reviewedAt && r.reviewEvidence && r.reviewedRevision === m.version && r.revision === m.version && r.reviewedFingerprint === editorialFingerprint(blueprintOf(m))) }; }), exams, questions };
}
export async function mutateAdminMock(user: AuthUser, raw: z.infer<typeof adminMockSchema>) {
 assertPlatformAdmin(user); const input = adminMockSchema.parse(raw);
 return atomic(async (tx) => {
   if (input.action === "create") {
     if (!await tx.exam.findUnique({ where: { id: input.blueprint.examId }, select: { id: true } })) throw absent();
     const mock = await tx.mockExam.create({ data: { ...input.blueprint, sections: input.blueprint.sections }, select: { id: true, version: true } });
     await tx.contentEditorialRecord.create({ data: { entity: "MOCK_EXAM", entityId: mock.id, revision: mock.version, authorId: user.id } });
     await tx.auditEvent.create({ data: { actorId: user.id, entity: "MOCK_EXAM", entityId: mock.id, action: "MOCK_CREATED_DRAFT" } }); return mock;
   }
   const mock = await tx.mockExam.findUnique({ where: { id: input.id } }); if (!mock) throw absent();
   if (mock.version !== input.version) throw new ConflictApiError("Blueprint changed. Reload first.");
   if (input.action !== "validate" && await tx.competition.findFirst({ where: { mockExamId: mock.id, status: { not: "CANCELLED" } }, select: { id: true } })) {
     throw new ValidationApiError("This blueprint is reserved for a competition. Cancel the competition before changing it.");
   }
   if (input.action === "edit" && mock.status !== "DRAFT") throw new ValidationApiError("Unpublish before editing");
   if (["validate", "publish", "review"].includes(input.action)) await freeze(tx, blueprintOf(mock));
   if (input.action === "validate") return { id: mock.id, version: mock.version, valid: true };
   const reviewWhere = { entity_entityId: { entity: "MOCK_EXAM", entityId: mock.id } };
   if (input.action === "review") {
     const review = await tx.contentEditorialRecord.findUnique({ where: reviewWhere });
     if (mock.status !== "DRAFT" || !review || review.revision !== mock.version || review.authorId === user.id) throw new ValidationApiError("A different reviewer must review the current saved draft");
     await tx.contentEditorialRecord.update({ where: reviewWhere, data: { reviewerId: user.id, reviewedRevision: mock.version,
       reviewedFingerprint: editorialFingerprint(blueprintOf(mock)), reviewEvidence: input.evidence, reviewedAt: new Date() } });
     await tx.auditEvent.create({ data: { actorId: user.id, entity: "MOCK_EXAM", entityId: mock.id, action: "MOCK_REVIEWED", detail: JSON.stringify({ evidence: input.evidence, version: mock.version }) } });
     return { id: mock.id, version: mock.version };
   }
   if (input.action === "publish") await requireMockReview(tx, mock);
   const changed = await tx.mockExam.updateMany({ where: { id: mock.id, version: input.version }, data: {
     ...(input.action === "edit" ? input.blueprint : {}), status: input.action === "publish" ? "PUBLISHED" : "DRAFT", version: { increment: 1 } } });
   if (changed.count !== 1) throw new ConflictApiError("Blueprint changed. Reload first.");
   if (input.action === "edit") await tx.contentEditorialRecord.upsert({ where: reviewWhere,
     create: { entity: "MOCK_EXAM", entityId: mock.id, revision: mock.version + 1, authorId: user.id },
     update: { revision: mock.version + 1, authorId: user.id, reviewerId: null, reviewedAt: null, reviewedRevision: null, reviewedFingerprint: null, reviewEvidence: null } });
   else {
     const review = await tx.contentEditorialRecord.findUnique({ where: reviewWhere });
     if (review) await tx.contentEditorialRecord.update({ where: reviewWhere, data: { revision: mock.version + 1,
       reviewedRevision: review.reviewedRevision === mock.version ? mock.version + 1 : null } });
   }
   await tx.auditEvent.create({ data: { actorId: user.id, entity: "MOCK_EXAM", entityId: mock.id, action: `MOCK_${input.action.toUpperCase()}` } });
   return { id: mock.id, version: mock.version + 1 };
 });
}

export async function getMockRevision(user: AuthUser) {
 assertStudent(user);
 const attempts = await prisma.mockAttempt.findMany({ where: { userId: user.id, status: { not: "IN_PROGRESS" } },
   take: 20, orderBy: { startedAt: "desc" }, include: includeAnswers });
 const entries = attempts.flatMap((attempt) => {
   const snap = snapshotOf(attempt), result = attempt.result as unknown as Result;
   return attempt.answers.flatMap((saved) => {
     const q = snap.questions[saved.position], outcome = result.outcomes[saved.position];
     const reveal = snap.revealPolicy === "AFTER_SUBMISSION";
     const reasons = [saved.flagged ? "Flagged" : "", saved.bookmarked ? "Bookmarked" : "",
       reveal && !outcome.answered ? "Unanswered" : reveal && !outcome.correct ? "Incorrect" : ""].filter(Boolean);
     if (!reasons.length) return [];
     return [{ attemptId: attempt.id, title: snap.title, ...publicQuestion(q, saved.position),
       answer: saved.answer as SavedAnswer["answer"], reasons, bookmarked: saved.bookmarked,
       reviewedAt: saved.reviewedAt?.toISOString() ?? null, revisionTaskId: saved.revisionTaskId,
       correct: reveal ? outcome.correct : null, explanation: reveal ? q.explanation : null }];
   });
 });
 // Recheck publication at review time, not only when the attempt was started.
 const lessonIds = attempts.flatMap((a) => snapshotOf(a).questions.map((q) => q.lessonId).filter((id): id is string => Boolean(id)));
 const lessons = lessonIds.length ? await prisma.lesson.findMany({ where: { id: { in: lessonIds }, ...published, chapter: { ...published, subject: published } },
   select: { id: true, slug: true, chapter: { select: { slug: true, subject: { select: { slug: true } } } } } }) : [];
 return entries.map((entry) => { const a = attempts.find((a) => a.id === entry.attemptId)!;
   const q = snapshotOf(a).questions[entry.position], lesson = lessons.find((l) => l.id === q.lessonId);
   return { ...entry, lessonHref: lesson ? `/learn/${lesson.chapter.subject.slug}/${lesson.chapter.slug}/${lesson.slug}` : null }; });
}
export async function mutateMockRevision(user: AuthUser, raw: z.infer<typeof revisionSchema>) {
 assertStudent(user); const input = revisionSchema.parse(raw);
 return atomic(async (tx) => {
   const attempt = await ownerAttempt(tx, user, input.attemptId);
   if (attempt.status === "IN_PROGRESS") throw new ValidationApiError("Finish the exam before revision");
   const answer = attempt.answers.find((a) => a.position === input.position);
   const question = snapshotOf(attempt).questions[input.position]; if (!answer || !question) throw absent();
   if (input.action === "mission") {
     if (answer.revisionTaskId) return { taskId: answer.revisionTaskId };
     const plan = await tx.studyPlan.findFirst({ where: { userId: user.id, active: true }, select: { id: true, dailyMinutes: true } });
     if (!plan) throw new ValidationApiError("Save a mission plan first");
     let href = "/practice/revision";
     if (question.lessonId) { const lesson = await tx.lesson.findFirst({ where: { id: question.lessonId, ...published, chapter: { ...published, subject: published } },
       select: { slug: true, chapter: { select: { slug: true, subject: { select: { slug: true } } } } } });
       if (lesson) href = `/learn/${lesson.chapter.subject.slug}/${lesson.chapter.slug}/${lesson.slug}`; }
     const dueDate = await nextRevisionDate(tx, plan.id, plan.dailyMinutes);
     const task = await tx.missionTask.create({ data: { planId: plan.id, title: `Review ${question.subject}: ${snapshotOf(attempt).title}`.slice(0, 160),
       subject: question.subject, href, dueDate, minutes: 15 }, select: { id: true } });
     await tx.mockAnswer.update({ where: { id: answer.id }, data: { revisionTaskId: task.id } }); return { taskId: task.id };
   }
   await tx.mockAnswer.update({ where: { id: answer.id }, data: input.action === "reviewed" ? { reviewedAt: new Date() } : { bookmarked: input.bookmarked } });
   return { saved: true };
 });
}
