import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), manage: vi.fn(), question: vi.fn(), source: vi.fn(), revision: vi.fn(), mutate: vi.fn(), state: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/server/db", () => ({ prisma: { contentSource: { findUnique: mocks.source }, practiceRevisionState: { findUnique: mocks.state } } }));
vi.mock("@/server/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@/server/question/authoring", async importOriginal => ({ ...await importOriginal<object>(), manageQuestion: mocks.manage, questionRevision: mocks.question }));
vi.mock("@/server/practice/revision", async importOriginal => ({ ...await importOriginal<object>(), getPracticeRevision: mocks.revision, mutatePracticeRevision: mocks.mutate }));
import { GET as ADMIN_GET, POST as ADMIN_POST } from "@/app/api/admin/content/questions/route";
import { GET, POST } from "@/app/api/student/practice/revision/route";
const user = { id: "student", role: "STUDENT", name: "Student", email: "s@example.test" };
const decision = { action: "PUBLISH", id: "q", fingerprint: "0".repeat(64), evidence: "Publish independently reviewed content" };
const bookmark = { action: "BOOKMARK", questionId: "q", bookmarked: true };
function request(body: unknown, origin = "https://toprank.test") { return new Request("https://toprank.test/api", { method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body) }); }
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("APP_URL", "https://toprank.test"); mocks.user.mockResolvedValue(user); mocks.revision.mockResolvedValue({ entries: [] }); });
afterEach(() => vi.unstubAllEnvs());
describe("Phase 5 private HTTP boundaries (mocked services)", () => {
  it.each([GET, POST, ADMIN_GET, ADMIN_POST])("rejects anonymous requests", async handler => { mocks.user.mockResolvedValue(null); expect((await handler(request({}))).status).toBe(401); expect(mocks.manage).not.toHaveBeenCalled(); expect(mocks.mutate).not.toHaveBeenCalled(); });
  it.each(["STUDENT", "TEACHER", "PARENT", "SCHOOL_ADMIN"])("denies %s protected answers and admin writes", async role => {
    mocks.user.mockResolvedValue({ ...user, role }); expect((await ADMIN_GET(new Request("https://toprank.test/api?id=q"))).status).toBe(403); expect((await ADMIN_POST(request(decision))).status).toBe(403); expect(mocks.question).not.toHaveBeenCalled(); expect(mocks.manage).not.toHaveBeenCalled();
  });
  it("denies foreign-origin mutations before the service", async () => {
    expect((await POST(request(bookmark, "https://evil.test"))).status).toBe(403); mocks.user.mockResolvedValue({ ...user, role: "PLATFORM_ADMIN" }); expect((await ADMIN_POST(request(decision, "https://evil.test"))).status).toBe(403);
    expect(mocks.manage).not.toHaveBeenCalled(); expect(mocks.mutate).not.toHaveBeenCalled();
  });
  it("ignores no client ownership, roles or timestamps", async () => { for (const field of ["userId", "role", "reviewedAt"]) expect((await POST(request({ ...bookmark, [field]: "forged" }))).status).toBe(400); expect(mocks.mutate).not.toHaveBeenCalled(); });
  it("reads exact owner-bound bookmark status without queue truncation", async () => {
    mocks.state.mockResolvedValue({ bookmarked: true }); const response = await GET(new Request("https://toprank.test/api?questionId=q")); expect(response.status).toBe(200); expect((await response.json()).data).toEqual({ bookmarked: true });
    expect(mocks.state).toHaveBeenCalledWith({ where: { userId_questionId: { userId: user.id, questionId: "q" } }, select: { bookmarked: true } }); expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("only an administrator can inspect protected keys", async () => {
    mocks.user.mockResolvedValue({ ...user, role: "PLATFORM_ADMIN" }); mocks.question.mockResolvedValue({ numericalAnswer: "123" }); mocks.source.mockResolvedValue(null);
    const response = await ADMIN_GET(new Request("https://toprank.test/api?id=q")); expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("sanitizes errors without secrets or database internals", async () => {
    mocks.mutate.mockRejectedValue(new Error("secret connection internal stack")); const response = await POST(request(bookmark)); expect(response.status).toBe(500); expect(await response.text()).not.toMatch(/secret|connection|internal|stack/);
  });
  it("bounds question mutation envelopes before any write", async () => {
    mocks.user.mockResolvedValue({ ...user, role: "PLATFORM_ADMIN" }); expect((await ADMIN_POST(request({ data: "x".repeat(65537) }))).status).toBe(413); expect(mocks.manage).not.toHaveBeenCalled();
  });
});
