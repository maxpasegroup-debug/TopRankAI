import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST, PATCH } from "@/app/api/account/privacy-requests/route";
import { GET as queue, PATCH as decide } from "@/app/api/admin/privacy-requests/route";
import { DELETE as withdraw } from "@/app/api/account/consent/route";
import { AuthorizationApiError } from "@/server/api/errors";

const mocks = vi.hoisted(() => ({ user: vi.fn(), list: vi.fn(), create: vi.fn(), reply: vi.fn(), queue: vi.fn(), decide: vi.fn(), withdraw: vi.fn() }));
vi.mock("@/server/db", () => ({ prisma: {} }));
vi.mock("@/server/logger", () => ({ logger: { error: vi.fn(), info: vi.fn() } }));
vi.mock("@/server/auth/rate-limit", () => ({ authRateLimiter: null }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: mocks.user, SESSION_COOKIE: "toprank_session", sessionCookieOptions: (expires: Date) => ({ httpOnly: true, secure: true, sameSite: "lax", path: "/", expires }) }));
vi.mock("@/server/auth/account-consent", () => ({ withdrawAccountConsent: mocks.withdraw, acceptAccountConsent: vi.fn() }));
vi.mock("@/server/operations/service", () => ({ assertPlatformAdmin: (user: { role: string }) => { if (user.role !== "PLATFORM_ADMIN") throw new AuthorizationApiError(); } }));
vi.mock("@/server/auth/privacy-requests", async importOriginal => {
  const original = await importOriginal<typeof import("@/server/auth/privacy-requests")>();
  return { ...original, listPrivacyRequests: mocks.list, createPrivacyRequest: mocks.create, replyPrivacyRequest: mocks.reply, listPrivacyQueue: mocks.queue, decidePrivacyRequest: mocks.decide };
});
const student = { id: "s1", role: "STUDENT", email: "student@example.com", name: "Student", requiresLegalConsent: true };
const input = { requestKey: "00000000-0000-4000-8000-000000000001", kind: "ACCESS", message: "Please help with my account data" };
function request(method = "GET", body?: unknown, origin = "https://toprank.test") {
  return new Request("https://toprank.test/api/account/privacy-requests?page=2", { method, headers: { origin, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("APP_URL", "https://toprank.test");
  mocks.user.mockResolvedValue(student); mocks.list.mockResolvedValue({ records: [] }); mocks.create.mockResolvedValue({ id: "p1" }); mocks.withdraw.mockResolvedValue({ withdrawn: true });
});
afterEach(() => vi.unstubAllEnvs());
describe("privacy HTTP boundaries (mocked services, real validators and response envelopes)", () => {
  it("permits consent-only account access without exposing ordinary student access", async () => {
    const response = await GET(request()); expect(response.status).toBe(200);
    expect(mocks.user).toHaveBeenCalledWith(true); expect(mocks.list).toHaveBeenCalledWith(student, "2"); expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it.each([GET, POST, PATCH])("requires an authenticated account", async handler => {
    mocks.user.mockResolvedValue(null); expect((await handler(request(handler === GET ? "GET" : handler === POST ? "POST" : "PATCH", handler === GET ? undefined : input))).status).toBe(401);
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.reply).not.toHaveBeenCalled();
  });
  it.each(["TEACHER", "SCHOOL_ADMIN", "PLATFORM_ADMIN"])("does not treat %s as a student or guardian", async role => {
    mocks.user.mockResolvedValue({ ...student, role }); expect((await POST(request("POST", input))).status).toBe(403); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("accepts a parent account but derives the actor only from the session", async () => {
    const parent = { ...student, role: "PARENT" }; mocks.user.mockResolvedValue(parent);
    expect((await POST(request("POST", input))).status).toBe(200); expect(mocks.create).toHaveBeenCalledWith(parent, input);
  });
  it.each([POST, PATCH])("rejects cross-origin mutations before service calls", async handler => {
    expect((await handler(request("POST", input, "https://attacker.test"))).status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.reply).not.toHaveBeenCalled();
  });
  it.each([{ requesterId: "other" }, { status: "RESOLVED" }, { reviewerId: "admin" }])("rejects forged ownership and workflow fields", async extra => {
    expect((await POST(request("POST", { ...input, ...extra }))).status).toBe(400); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rejects oversized bodies before persistence", async () => {
    expect((await POST(request("POST", { ...input, message: "x".repeat(5000) }))).status).toBe(413); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("sanitizes unexpected service errors", async () => {
    mocks.create.mockRejectedValue(new Error("private database connection detail")); const response = await POST(request("POST", input));
    expect(response.status).toBe(500); expect(await response.text()).not.toContain("private database");
  });
  it.each([queue, decide])("denies the admin queue and decisions to students", async handler => {
    expect((await handler(request())).status).toBe(403); expect(mocks.queue).not.toHaveBeenCalled(); expect(mocks.decide).not.toHaveBeenCalled();
  });
  it("clears the session cookie only after successful withdrawal", async () => {
    const response = await withdraw(request("DELETE")); expect(response.status).toBe(200);
    expect(mocks.withdraw).toHaveBeenCalledWith(student); expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
  it("does not report successful withdrawal or clear the cookie after a failed transaction", async () => {
    mocks.withdraw.mockRejectedValue(new Error("private failure")); const response = await withdraw(request("DELETE"));
    expect(response.status).toBe(500); expect(response.headers.get("set-cookie")).toBeNull();
  });
});
