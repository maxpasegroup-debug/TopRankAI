import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), mutate: vi.fn(), attempt: vi.fn(), list: vi.fn(), revision: vi.fn(), review: vi.fn(), admin: vi.fn(), adminMutate: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/server/db", () => ({ prisma: {} }));
vi.mock("@/server/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@/server/mock/service", () => ({ mutateMock: mocks.mutate, getMockAttempt: mocks.attempt, listStudentMocks: mocks.list,
 getMockRevision: mocks.revision, mutateMockRevision: mocks.review, adminMocks: mocks.admin, mutateAdminMock: mocks.adminMutate }));
import { POST, GET } from "@/app/api/student/mocks/route";
import { POST as REVIEW } from "@/app/api/student/mocks/revision/route";
import { POST as ADMIN } from "@/app/api/admin/mocks/route";
const student = { id: "student", role: "STUDENT", name: "A", email: "a@example.com" };
function req(data: unknown, origin = "https://toprank.test") { return new Request("https://toprank.test/api/student/mocks", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(data) }); }
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("APP_URL", "https://toprank.test"); mocks.user.mockResolvedValue(student); mocks.mutate.mockResolvedValue({ status: "SUBMITTED" }); });
afterEach(() => vi.unstubAllEnvs());
describe("mock API authorization and validation (mocked services)", () => {
 it.each([POST, REVIEW, ADMIN])("requires a database-backed session before mutation", async (handler) => { mocks.user.mockResolvedValue(null); expect((await handler(req({}))).status).toBe(401); expect(mocks.mutate).not.toHaveBeenCalled(); expect(mocks.review).not.toHaveBeenCalled(); expect(mocks.adminMutate).not.toHaveBeenCalled(); });
 it.each(["PARENT", "TEACHER", "SCHOOL_ADMIN", "PLATFORM_ADMIN"])("denies %s student exam access", async (role) => { mocks.user.mockResolvedValue({ ...student, role }); expect((await POST(req({ action: "submit", attemptId: "attempt" }))).status).toBe(403); expect(mocks.mutate).not.toHaveBeenCalled(); });
 it("denies students admin publication", async () => { expect((await ADMIN(req({}))).status).toBe(403); expect(mocks.adminMutate).not.toHaveBeenCalled(); });
 it.each([POST, REVIEW, ADMIN])("denies foreign-origin mutations", async (handler) => { if (handler === ADMIN) mocks.user.mockResolvedValue({ ...student, role: "PLATFORM_ADMIN" }); expect((await handler(req({}, "https://evil.test"))).status).toBe(403); expect(mocks.mutate).not.toHaveBeenCalled(); expect(mocks.review).not.toHaveBeenCalled(); expect(mocks.adminMutate).not.toHaveBeenCalled(); });
 it.each(["userId", "score", "deadline", "role", "answerKey"])("rejects forged %s", async (field) => { expect((await POST(req({ action: "submit", attemptId: "attempt", [field]: "forged" }))).status).toBe(400); expect(mocks.mutate).not.toHaveBeenCalled(); });
 it("derives ownership exclusively from the session and disables caching", async () => { const response = await POST(req({ action: "submit", attemptId: "attempt" })); expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store"); expect(mocks.mutate).toHaveBeenCalledWith(student, { action: "submit", attemptId: "attempt" }); });
 it("keeps student answer requests bounded at 4 KiB", async () => { expect((await POST(req({ text: "x".repeat(5000) }))).status).toBe(413); expect(mocks.mutate).not.toHaveBeenCalled(); });
 it("accepts a bounded 200-question admin blueprint larger than 4 KiB", async () => {
   mocks.user.mockResolvedValue({ ...student, role: "PLATFORM_ADMIN" });
   const section = (title: string, offset: number) => ({ title, questionCount: 100, questionIds: Array.from({ length: 100 }, (_, i) => `question-${String(i + offset).padStart(24, "0")}`), marks: "4", negativeMarks: "1", unansweredMarks: "0" });
   const data = { action: "create", blueprint: { examId: "exam", title: "Mock exam", durationSeconds: 60, maxAttempts: 1, revealPolicy: "NEVER", sections: [section("A", 0), section("B", 100)] } };
   expect(JSON.stringify(data).length).toBeGreaterThan(4096); expect((await ADMIN(req(data))).status).toBe(200); expect(mocks.adminMutate).toHaveBeenCalled();
 });
 it("rejects admin payloads beyond 32 KiB", async () => { mocks.user.mockResolvedValue({ ...student, role: "PLATFORM_ADMIN" }); expect((await ADMIN(req({ data: "x".repeat(32769) }))).status).toBe(413); expect(mocks.adminMutate).not.toHaveBeenCalled(); });
 it("sanitizes unexpected database failures", async () => { mocks.mutate.mockRejectedValue(new Error("private SQL postgres://secret")); const response = await POST(req({ action: "submit", attemptId: "attempt" })); expect(response.status).toBe(500); expect(await response.text()).not.toMatch(/SQL|postgres|secret|stack/); });
 it("passes the session owner to attempt reads", async () => { const response = await GET(new Request("https://toprank.test/api/student/mocks?attemptId=attempt")); expect(response.status).toBe(200); expect(mocks.attempt).toHaveBeenCalledWith(student, "attempt"); expect(response.headers.get("cache-control")).toBe("no-store"); });
 it("requires recorded review evidence and rejects reviewer identity claims", async () => {
   mocks.user.mockResolvedValue({ ...student, role: "PLATFORM_ADMIN" });
   const review = { action: "review", id: "mock", version: 0, evidence: "Reviewed duration and marking" };
   expect((await ADMIN(req({ ...review, reviewerId: "forged" }))).status).toBe(400);
   expect((await ADMIN(req({ action: "review", id: "mock", version: 0 }))).status).toBe(400);
   expect((await ADMIN(req(review))).status).toBe(200); expect(mocks.adminMutate).toHaveBeenCalledWith(expect.objectContaining({ role: "PLATFORM_ADMIN" }), review);
 });
});
