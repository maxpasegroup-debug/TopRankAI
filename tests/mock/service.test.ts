import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import type { AuthUser } from "@/server/auth/session";
import { ConflictApiError, AuthorizationApiError, ValidationApiError } from "@/server/api/errors";
import { calculateResult, type Snapshot } from "@/server/mock/engine";
const db = vi.hoisted(() => ({ $transaction: vi.fn(), commerceGate: { findUnique: vi.fn() }, entitlement: { findFirst: vi.fn() }, studentProfile: { findUnique: vi.fn() }, competition: { findFirst: vi.fn() },
 mockExam: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
 mockAttempt: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
 mockAnswer: { updateMany: vi.fn(), update: vi.fn() }, exam: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
 questionExam: { findMany: vi.fn() }, question: { findMany: vi.fn() }, lesson: { findMany: vi.fn(), findFirst: vi.fn() },
 contentEditorialRecord: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn() },
 studyPlan: { findFirst: vi.fn() }, missionTask: { create: vi.fn(), aggregate: vi.fn() }, auditEvent: { create: vi.fn() } }));
vi.mock("@/server/db", () => ({ prisma: db }));
import { mutateMock, getMockAttempt, listStudentMocks, mutateAdminMock, getMockRevision, mutateMockRevision, adminMocks } from "@/server/mock/service";
import { editorialFingerprint } from "@/server/content/editorial";
const user: AuthUser = { id: "student", name: "Student", email: "s@example.com", role: "STUDENT" };
const admin: AuthUser = { ...user, id: "admin", role: "PLATFORM_ADMIN" };
const now = new Date("2026-10-10T00:00:00Z");
const blueprint = { examId: "exam", title: "Mock exam", durationSeconds: 60, maxAttempts: 2, revealPolicy: "AFTER_SUBMISSION" as const,
 sections: [{ title: "Science", questionCount: 1, questionIds: ["q"], marks: "4", negativeMarks: "1", unansweredMarks: "0" }] };
const snapshot: Snapshot = { title: "Mock exam", revealPolicy: "AFTER_SUBMISSION", sections: blueprint.sections,
 questions: [{ id: "q", text: "Protected question", type: "NUMERICAL", section: 0, subject: "Physics", lessonId: null, lessonHref: null,
 marks: "4", negativeMarks: "1", unansweredMarks: "0", mode: "DECIMAL_EXACT", numericalAnswer: "998.75", explanation: "A reviewed explanation", options: [] }] };
const startInput = { action: "start" as const, mockId: "mock", requestKey: "8664dc14-a97f-4e63-9747-0a76e597a077" };
const saveInput = { action: "save" as const, attemptId: "attempt", position: 0, version: 0, answer: { numerical: "1" }, flagged: true, bookmarked: true };
function record(overrides = {}) { return { id: "attempt", userId: user.id, mockExamId: "mock", requestKey: startInput.requestKey,
 status: "IN_PROGRESS", startedAt: now, deadline: new Date(now.getTime() + 60000), finalizedAt: null, result: null, snapshot,
 answers: [{ id: "answer", attemptId: "attempt", position: 0, answer: {}, version: 0, flagged: false, bookmarked: false, reviewedAt: null, revisionTaskId: null }], ...overrides }; }
let attempt: ReturnType<typeof record>;
afterEach(() => vi.useRealTimers());
beforeEach(() => {
 vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(now); attempt = record();
 db.missionTask.aggregate.mockResolvedValue({ _sum: { minutes: 0 } });
 db.contentEditorialRecord.findMany.mockResolvedValue([]);
 db.contentEditorialRecord.findUnique.mockResolvedValue({ authorId: "author", reviewerId: "reviewer", revision: 0, reviewedRevision: 0,
   reviewedAt: now, reviewEvidence: "Checked blueprint and marking", reviewedFingerprint: editorialFingerprint(blueprint) });
 db.$transaction.mockImplementation((fn) => fn(db)); db.mockAttempt.findFirst.mockImplementation(async (args) => args.where.id ? attempt : null);
 db.competition.findFirst.mockResolvedValue(null);
 db.commerceGate.findUnique.mockResolvedValue(null);
 db.mockAttempt.findUnique.mockResolvedValue(null); db.mockAttempt.findMany.mockResolvedValue([]); db.mockAttempt.count.mockResolvedValue(0);
 db.mockAttempt.updateMany.mockImplementation(async ({ data }) => { Object.assign(attempt, data); return { count: 1 }; });
 db.mockAnswer.updateMany.mockImplementation(async ({ data }) => { Object.assign(attempt.answers[0], data, { version: attempt.answers[0].version + 1 }); return { count: 1 }; });
 db.mockAttempt.create.mockImplementation(async ({ data }) => ({ ...record(), ...data, answers: record().answers }));
 db.studentProfile.findUnique.mockResolvedValue({ targetExamId: "exam", onboardingCompletedAt: now });
 db.mockExam.findFirst.mockResolvedValue({ id: "mock", status: "PUBLISHED", version: 0, ...blueprint });
 db.mockExam.findUnique.mockResolvedValue({ id: "mock", status: "DRAFT", version: 0, ...blueprint });
 db.mockExam.updateMany.mockResolvedValue({ count: 1 }); db.mockExam.create.mockResolvedValue({ id: "mock", version: 0 });
 db.exam.findFirst.mockResolvedValue({ id: "exam" }); db.exam.findUnique.mockResolvedValue({ id: "exam" }); db.exam.findMany.mockResolvedValue([]);
 db.questionExam.findMany.mockResolvedValue([{ questionId: "q", scoringMode: "DECIMAL_EXACT", question: {
 id: "q", text: "Protected question", type: "NUMERICAL", subjectId: "s", chapterId: "c", lessonId: null,
 numericalAnswer: "998.75", explanation: "A reviewed explanation", options: [], subject: { name: "Physics", slug: "physics" }, chapter: { slug: "motion", subjectId: "s" }, lesson: null } }]);
 db.lesson.findMany.mockResolvedValue([]); db.lesson.findFirst.mockResolvedValue(null);
});
describe("timed mock lifecycle (mocked database only)", () => {
 it("enforces a configured paid feature before creating a new mock attempt", async () => {
   db.commerceGate.findUnique.mockResolvedValue({ featureCode: "MOCK_ACCESS" }); db.entitlement.findFirst.mockResolvedValue(null);
   await expect(mutateMock(user, startInput)).rejects.toBeInstanceOf(AuthorizationApiError); expect(db.mockAttempt.create).not.toHaveBeenCalled();
 });
 it("starts with server timestamps, unique request key, frozen private keys and persisted blank answers", async () => {
   const value = await mutateMock(user, startInput); expect(value).toMatchObject({ startedAt: now.toISOString(), deadline: new Date(now.getTime() + 60000).toISOString() });
   expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
   expect(db.mockAttempt.create.mock.calls[0][0].data.snapshot.questions[0].numericalAnswer).toBe("998.75");
   expect(JSON.stringify(value)).not.toContain("998.75"); expect(JSON.stringify(value)).not.toContain("numericalAnswer");
   expect(db.mockAttempt.create.mock.calls[0][0].data.answers.create).toEqual([{ position: 0, answer: {} }]);
 });
 it("replays the same start without inserting a second attempt", async () => { db.mockAttempt.findUnique.mockResolvedValue(attempt); await mutateMock(user, startInput); expect(db.mockAttempt.create).not.toHaveBeenCalled(); });
 it("rejects reuse of a start key for a different mock", async () => { db.mockAttempt.findUnique.mockResolvedValue({ ...attempt, mockExamId: "other" }); await expect(mutateMock(user, startInput)).rejects.toBeInstanceOf(ConflictApiError); });
 it("resumes the current active attempt for a second start key", async () => { db.mockAttempt.findFirst.mockResolvedValue(attempt); expect(await mutateMock(user, startInput)).toMatchObject({ id: "attempt" }); expect(db.mockAttempt.create).not.toHaveBeenCalled(); });
 it("enforces attempt limits before creation", async () => { db.mockAttempt.count.mockResolvedValue(2); await expect(mutateMock(user, startInput)).rejects.toBeInstanceOf(ValidationApiError); expect(db.mockAttempt.create).not.toHaveBeenCalled(); });
 it("requires completed onboarding and target exam eligibility", async () => { db.studentProfile.findUnique.mockResolvedValue({ targetExamId: "exam", onboardingCompletedAt: null }); await expect(mutateMock(user, startInput)).rejects.toBeInstanceOf(ValidationApiError); expect(db.mockAttempt.create).not.toHaveBeenCalled(); });
 it("does not start inaccessible or unpublished exams", async () => { db.mockExam.findFirst.mockResolvedValue(null); await expect(mutateMock(user, startInput)).rejects.toBeInstanceOf(ValidationApiError); });
 it("does not allow public practice to start a reserved competition mock", async () => { db.competition.findFirst.mockResolvedValue({ id: "c", status: "PUBLISHED", mockVersion: 0, startsAt: now, endsAt: new Date(now.getTime() + 60000) }); await expect(mutateMock(user, startInput)).rejects.toThrow("through its competition"); expect(db.mockAttempt.create).not.toHaveBeenCalled(); });
 it("permits only the trusted internal competition path within its window", async () => { db.competition.findFirst.mockResolvedValue({ id: "c", status: "PUBLISHED", mockVersion: 0, startsAt: now, endsAt: new Date(now.getTime() + 60000) }); expect(await mutateMock(user, startInput, "c")).toMatchObject({ id: "attempt" }); });
 it("rejects a client-injected competition identifier", async () => { await expect(mutateMock(user, { ...startInput, competitionId: "c" } as typeof startInput)).rejects.toThrow(); expect(db.mockAttempt.create).not.toHaveBeenCalled(); });
 it("does not start with unpublished/missing question links", async () => { db.questionExam.findMany.mockResolvedValue([]); await expect(mutateMock(user, startInput)).rejects.toBeInstanceOf(ValidationApiError); expect(db.mockAttempt.create).not.toHaveBeenCalled(); });
 it("persists answers and flags with compare-and-swap versioning", async () => {
   const value = await mutateMock(user, saveInput); expect(value.answers[0]).toMatchObject({ answer: { numerical: "1" }, flagged: true, bookmarked: true, version: 1 });
   expect(db.mockAnswer.updateMany.mock.calls[0][0].where).toMatchObject({ version: 0, attempt: { userId: user.id, status: "IN_PROGRESS" } });
 });
 it("rejects malformed numerical answers before database writes", async () => { await expect(mutateMock(user, { ...saveInput, answer: { numerical: "1e2" } })).rejects.toThrow(); expect(db.mockAnswer.updateMany).not.toHaveBeenCalled(); });
 it("rejects an option answer to a numerical question", async () => { await expect(mutateMock(user, { ...saveInput, answer: { optionIds: ["foreign"] } })).rejects.toThrow(); expect(db.mockAnswer.updateMany).not.toHaveBeenCalled(); });
 it("allows clearing a previously saved answer", async () => { attempt.answers[0].answer = { numerical: "1" } as typeof attempt.answers[0]["answer"]; expect((await mutateMock(user, { ...saveInput, answer: {} })).answers[0].answer).toEqual({}); });
 it("rejects stale, different answers without overwriting", async () => { attempt.answers[0].version = 1; await expect(mutateMock(user, saveInput)).rejects.toBeInstanceOf(ConflictApiError); expect(db.mockAnswer.updateMany).not.toHaveBeenCalled(); });
 it("idempotently replays an already saved answer", async () => { await mutateMock(user, saveInput); db.mockAnswer.updateMany.mockClear(); await mutateMock(user, saveInput); expect(db.mockAnswer.updateMany).not.toHaveBeenCalled(); });
 it("rejects invalid question positions", async () => { await expect(mutateMock(user, { ...saveInput, position: 1 })).rejects.toBeInstanceOf(ValidationApiError); });
 it("auto-finalizes expiry on read, capping elapsed time", async () => {
   vi.setSystemTime(new Date(now.getTime() + 120000)); const result = await getMockAttempt(user, "attempt");
   expect(result).toMatchObject({ status: "EXPIRED", finalizedAt: new Date(now.getTime() + 60000).toISOString(), result: { score: "0", timeSeconds: 60 } });
 });
 it("late saves finalize but never modify answers", async () => { vi.setSystemTime(new Date(now.getTime() + 60000)); expect(await mutateMock(user, saveInput)).toMatchObject({ status: "EXPIRED" }); expect(db.mockAnswer.updateMany).not.toHaveBeenCalled(); });
 it("scores from frozen keys and makes repeated submission idempotent", async () => {
   attempt.answers[0].answer = { numerical: "998.750" } as typeof attempt.answers[0]["answer"];
   vi.setSystemTime(new Date(now.getTime() + 10000)); const result = await mutateMock(user, { action: "submit", attemptId: "attempt" });
   expect(result).toMatchObject({ status: "SUBMITTED", result: { score: "4", accuracy: 100, timeSeconds: 10 } });
   expect(result.result).not.toHaveProperty("outcomes"); db.mockAttempt.updateMany.mockClear();
   expect(await mutateMock(user, { action: "submit", attemptId: "attempt" })).toMatchObject({ status: "SUBMITTED" }); expect(db.mockAttempt.updateMany).not.toHaveBeenCalled();
   expect(db.questionExam.findMany).not.toHaveBeenCalled();
 });
 it("never changes answers after submission", async () => { await mutateMock(user, { action: "submit", attemptId: "attempt" }); expect(await mutateMock(user, saveInput)).toMatchObject({ status: "SUBMITTED" }); expect(db.mockAnswer.updateMany).not.toHaveBeenCalled(); });
 it("exposes per-question review only after permitted finalization", async () => {
   expect((await getMockAttempt(user, "attempt")).review).toEqual([]);
   const result = await mutateMock(user, { action: "submit", attemptId: "attempt" });
   expect(result.review[0]).toMatchObject({ position: 0, explanation: "A reviewed explanation" });
   expect(JSON.stringify(result)).not.toContain("numericalAnswer"); expect(JSON.stringify(result)).not.toContain("998.75");
 });
 it("withholds per-question explanations under NEVER policy", async () => {
   attempt.snapshot = { ...snapshot, revealPolicy: "NEVER" } as typeof attempt.snapshot;
   expect((await mutateMock(user, { action: "submit", attemptId: "attempt" })).review).toEqual([]);
 });
 it("models duplicate finalization without a second result write", async () => {
   const results = await Promise.all([mutateMock(user, { action: "submit", attemptId: "attempt" }), mutateMock(user, { action: "submit", attemptId: "attempt" })]);
   expect(results.every(result => result.status === "SUBMITTED")).toBe(true); expect(db.mockAttempt.updateMany).toHaveBeenCalledTimes(1);
 });
 it("preserves acknowledged answers at the exact deadline", async () => {
   vi.setSystemTime(new Date(now.getTime() + 59999)); await mutateMock(user, saveInput);
   vi.setSystemTime(new Date(now.getTime() + 60000)); const result = await mutateMock(user, { ...saveInput, version: 1, answer: { numerical: "2" } });
   expect(result.status).toBe("EXPIRED"); expect(result.answers[0].answer).toEqual(saveInput.answer); expect(db.mockAnswer.updateMany).toHaveBeenCalledTimes(1);
 });
 it("uses only owner-bound attempt lookups and rejects foreign attempts", async () => { db.mockAttempt.findFirst.mockResolvedValue(null); await expect(getMockAttempt(user, "foreign")).rejects.toBeInstanceOf(ValidationApiError); expect(db.mockAttempt.findFirst.mock.calls[0][0].where).toEqual({ id: "foreign", userId: user.id }); });
 it.each(["TEACHER", "PARENT", "SCHOOL_ADMIN", "PLATFORM_ADMIN"] as const)("rejects %s before any database access", async (role) => { await expect(mutateMock({ ...user, role }, startInput)).rejects.toBeInstanceOf(AuthorizationApiError); expect(db.$transaction).not.toHaveBeenCalled(); });
 it("retries serialization conflicts with bounded retries", async () => {
   db.$transaction.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("retry", { code: "P2034", clientVersion: "7" }));
   await getMockAttempt(user, "attempt"); expect(db.$transaction).toHaveBeenCalledTimes(2);
 });
 it("returns a generic conflict after retry exhaustion", async () => {
   db.$transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("private database details", { code: "P2034", clientVersion: "7" }));
   await expect(getMockAttempt(user, "attempt")).rejects.toThrow("Concurrent update"); expect(db.$transaction).toHaveBeenCalledTimes(3);
 });
 it("only one of two modeled conflicting saves changes an answer", async () => {
   const results = await Promise.allSettled([mutateMock(user, saveInput), mutateMock(user, { ...saveInput, answer: { numerical: "2" } })]);
   expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1); expect(db.mockAnswer.updateMany).toHaveBeenCalledTimes(1);
 });
 it("a lost finalization compare-and-swap never writes a second result", async () => {
   db.mockAttempt.updateMany.mockResolvedValue({ count: 0 });
   await expect(mutateMock(user, { action: "submit", attemptId: "attempt" })).rejects.toBeInstanceOf(ConflictApiError);
   expect(db.mockAnswer.updateMany).not.toHaveBeenCalled();
 });
 it("retries a cross-process unique-start conflict without creating another attempt", async () => {
   db.$transaction.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("private duplicate", { code: "P2002", clientVersion: "7" }));
   db.mockAttempt.findUnique.mockResolvedValue(attempt); await mutateMock(user, startInput); expect(db.mockAttempt.create).not.toHaveBeenCalled(); expect(db.$transaction).toHaveBeenCalledTimes(2);
 });
 it("commits expiry even when no further attempts are permitted", async () => {
   db.mockAttempt.findFirst.mockResolvedValue(attempt); db.mockAttempt.count.mockResolvedValue(2); vi.setSystemTime(new Date(now.getTime() + 60000));
   expect(await mutateMock(user, startInput)).toMatchObject({ status: "EXPIRED" }); expect(db.mockAttempt.create).not.toHaveBeenCalled(); expect(db.mockAttempt.updateMany).toHaveBeenCalledTimes(1);
 });
 it("directory finalizes expired attempts but never exposes snapshots", async () => {
   db.mockExam.findMany.mockResolvedValue([{ id: "mock", ...blueprint }]); db.mockAttempt.findMany.mockResolvedValue([attempt]);
   vi.setSystemTime(new Date(now.getTime() + 60000)); const value = await listStudentMocks(user);
   expect(value.attempts[0].status).toBe("EXPIRED"); expect(JSON.stringify(value)).not.toContain("numericalAnswer");
 });
});
describe("mock admin publication (mocked database)", () => {
 it("records draft authorship in the existing editorial system", async () => {
   await mutateAdminMock(admin, { action: "create", blueprint }); expect(db.contentEditorialRecord.create).toHaveBeenCalledWith({ data: { entity: "MOCK_EXAM", entityId: "mock", revision: 0, authorId: admin.id } });
 });
 it("requires independent review before publication and a fresh start", async () => {
   db.contentEditorialRecord.findUnique.mockResolvedValue(null);
   await expect(mutateAdminMock(admin, { action: "publish", id: "mock", version: 0 })).rejects.toThrow("Independent review");
   await expect(mutateMock(user, startInput)).rejects.toThrow("Independent review"); expect(db.mockAttempt.create).not.toHaveBeenCalled(); expect(db.mockExam.updateMany).not.toHaveBeenCalled();
 });
 it("rejects author self-review", async () => {
   db.contentEditorialRecord.findUnique.mockResolvedValue({ authorId: admin.id, revision: 0 });
   await expect(mutateAdminMock(admin, { action: "review", id: "mock", version: 0, evidence: "Reviewed blueprint" })).rejects.toThrow("different reviewer"); expect(db.contentEditorialRecord.update).not.toHaveBeenCalled();
 });
 it("validates and records review without publication", async () => {
   await mutateAdminMock(admin, { action: "review", id: "mock", version: 0, evidence: "Checked marking and duration" });
   expect(db.contentEditorialRecord.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ reviewerId: admin.id, reviewedAt: now, reviewedRevision: 0, reviewedFingerprint: editorialFingerprint(blueprint) }) }));
   expect(db.mockExam.updateMany).not.toHaveBeenCalled();
 });
 it("rejects an approved fingerprint after blueprint contents change", async () => {
   db.mockExam.findUnique.mockResolvedValue({ id: "mock", status: "DRAFT", version: 0, ...blueprint, durationSeconds: 120 });
   await expect(mutateAdminMock(admin, { action: "publish", id: "mock", version: 0 })).rejects.toThrow("Independent review"); expect(db.mockExam.updateMany).not.toHaveBeenCalled();
 });
 it("invalidates review after an edit without altering active snapshots", async () => {
   await mutateAdminMock(admin, { action: "edit", id: "mock", version: 0, blueprint: { ...blueprint, durationSeconds: 120 } });
   expect(db.contentEditorialRecord.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ revision: 1, reviewerId: null, reviewedFingerprint: null, authorId: admin.id }) })); expect(db.mockAttempt.updateMany).not.toHaveBeenCalled();
 });
 it("keeps unchanged review valid when publication increments the lifecycle version", async () => {
   await mutateAdminMock(admin, { action: "publish", id: "mock", version: 0 });
   expect(db.contentEditorialRecord.update).toHaveBeenCalledWith(expect.objectContaining({ data: { revision: 1, reviewedRevision: 1 } }));
 });
 it("creates only draft blueprints and minimal audit events", async () => {
   await mutateAdminMock(admin, { action: "create", blueprint }); expect(db.mockExam.create.mock.calls[0][0].data).not.toHaveProperty("status");
   expect(db.auditEvent.create.mock.calls[0][0].data).toMatchObject({ entity: "MOCK_EXAM", action: "MOCK_CREATED_DRAFT" });
 });
 it("validates content and scoring before publishing", async () => { await mutateAdminMock(admin, { action: "publish", id: "mock", version: 0 }); expect(db.questionExam.findMany).toHaveBeenCalled(); expect(db.mockExam.updateMany.mock.calls[0][0].data.status).toBe("PUBLISHED"); });
 it("validation does not mutate the draft", async () => { expect(await mutateAdminMock(admin, { action: "validate", id: "mock", version: 0 })).toMatchObject({ valid: true }); expect(db.mockExam.updateMany).not.toHaveBeenCalled(); });
 it("invalid content cannot be published", async () => { db.questionExam.findMany.mockResolvedValue([]); await expect(mutateAdminMock(admin, { action: "publish", id: "mock", version: 0 })).rejects.toThrow(); expect(db.mockExam.updateMany).not.toHaveBeenCalled(); });
 it("requires unpublishing before editing", async () => { db.mockExam.findUnique.mockResolvedValue({ id: "mock", status: "PUBLISHED", version: 0, ...blueprint }); await expect(mutateAdminMock(admin, { action: "edit", id: "mock", version: 0, blueprint })).rejects.toThrow("Unpublish"); });
 it("rejects stale admin versions", async () => { await expect(mutateAdminMock(admin, { action: "unpublish", id: "mock", version: 1 })).rejects.toBeInstanceOf(ConflictApiError); });
 it("unpublishes without changing historical snapshots", async () => { await mutateAdminMock(admin, { action: "unpublish", id: "mock", version: 0 }); expect(db.mockAttempt.updateMany).not.toHaveBeenCalled(); });
 it("students cannot provision or publish mocks", async () => { await expect(mutateAdminMock(user, { action: "create", blueprint })).rejects.toBeInstanceOf(AuthorizationApiError); expect(db.$transaction).not.toHaveBeenCalled(); });
 it("admin catalog selects no answer keys", async () => { db.mockExam.findMany.mockResolvedValue([]); db.question.findMany.mockResolvedValue([]); await adminMocks(admin, "exam"); expect(db.question.findMany.mock.calls[0][0].select).toEqual({ id: true, code: true, text: true, type: true }); });
});
describe("persisted review and mission integration (mocked database)", () => {
 function complete(revealPolicy: "NEVER" | "AFTER_SUBMISSION" = "AFTER_SUBMISSION") {
   attempt = record({ status: "SUBMITTED", snapshot: { ...snapshot, revealPolicy }, result: calculateResult(snapshot, [], now, new Date(now.getTime() + 60000), now), finalizedAt: now });
   db.mockAttempt.findMany.mockResolvedValue([attempt]);
 }
 it("shows unanswered questions and permitted explanations, never numerical keys", async () => { complete(); const entries = await getMockRevision(user); expect(entries[0]).toMatchObject({ reasons: ["Unanswered"], explanation: "A reviewed explanation" }); expect(JSON.stringify(entries)).not.toContain("998.75"); });
 it("withheld review exposes neither correctness nor explanations", async () => { complete("NEVER"); attempt.answers[0].flagged = true; const entries = await getMockRevision(user); expect(entries[0]).toMatchObject({ correct: null, explanation: null, reasons: ["Flagged"] }); });
 it("withheld incorrect/unanswered outcomes do not leak through queue membership", async () => { complete("NEVER"); expect(await getMockRevision(user)).toEqual([]); });
 it("requires finalization before review actions", async () => { await expect(mutateMockRevision(user, { action: "reviewed", attemptId: "attempt", position: 0 })).rejects.toThrow(); expect(db.mockAnswer.update).not.toHaveBeenCalled(); });
 it("marking reviewed never changes answer or result", async () => { complete(); await mutateMockRevision(user, { action: "reviewed", attemptId: "attempt", position: 0 }); expect(db.mockAnswer.update.mock.calls[0][0].data).toEqual({ reviewedAt: now }); expect(db.mockAttempt.updateMany).not.toHaveBeenCalled(); });
 it("adds a revision task to the authenticated student's active mission", async () => { complete(); db.studyPlan.findFirst.mockResolvedValue({ id: "plan", dailyMinutes: 60 }); db.missionTask.create.mockResolvedValue({ id: "task" }); expect(await mutateMockRevision(user, { action: "mission", attemptId: "attempt", position: 0 })).toEqual({ taskId: "task" }); expect(db.studyPlan.findFirst.mock.calls[0][0].where).toEqual({ userId: user.id, active: true }); });
 it("repeated mission requests cannot add another task", async () => { complete(); Object.assign(attempt.answers[0], { revisionTaskId: "task" }); expect(await mutateMockRevision(user, { action: "mission", attemptId: "attempt", position: 0 })).toEqual({ taskId: "task" }); expect(db.missionTask.create).not.toHaveBeenCalled(); });
 it("requires a saved mission before adding tasks", async () => { complete(); db.studyPlan.findFirst.mockResolvedValue(null); await expect(mutateMockRevision(user, { action: "mission", attemptId: "attempt", position: 0 })).rejects.toThrow("Save a mission"); expect(db.missionTask.create).not.toHaveBeenCalled(); });
});
