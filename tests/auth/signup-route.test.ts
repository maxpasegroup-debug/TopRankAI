import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/auth/signup/route";
import { ACCOUNT_POLICY_VERSION } from "@/shared/account-policy";
const db = vi.hoisted(() => ({ transaction: vi.fn(), user: vi.fn() }));
vi.mock("@/server/db", () => ({ prisma: { $transaction: db.transaction, user: { create: db.user } } }));
vi.mock("@/server/auth/rate-limit", () => ({ authRateLimiter: null }));
const input = { name: "Student", email: "student@example.com", password: "password123", country: "IN", ageBand: "18_PLUS", termsAccepted: true, privacyAccepted: true, termsVersion: ACCOUNT_POLICY_VERSION, privacyVersion: ACCOUNT_POLICY_VERSION };
function request(extra = {}) { return new Request("http://localhost/api/auth/signup?role=PLATFORM_ADMIN", { method: "POST", headers: { origin: "http://localhost", "content-type": "application/json" }, body: JSON.stringify({ ...input, ...extra }) }); }
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("APP_URL", "http://localhost"); });
afterEach(() => vi.unstubAllEnvs());
describe("retired password signup cannot bypass email OTP", () => {
  it.each([{}, { role: "STUDENT" }])("requires the new workflow even for a valid student request", async extra => {
    const response = await POST(request(extra)); expect(response.status).toBe(410);
    expect(await response.json()).toMatchObject({ error: { code: "SIGNUP_UPDATED" } });
    expect(response.headers.get("set-cookie")).toBeNull(); expect(db.transaction).not.toHaveBeenCalled(); expect(db.user).not.toHaveBeenCalled();
  });
  it.each(["PLATFORM_ADMIN", "TEACHER", "PARENT", "SCHOOL_ADMIN", "UNKNOWN"])("still rejects %s role manipulation", async role => {
    expect((await POST(request({ role }))).status).toBe(400); expect(db.transaction).not.toHaveBeenCalled();
  });
  it.each([{ termsAccepted: false }, { privacyVersion: "old" }, { ageBand: "UNDER_13" }])("does not accept invalid consent", async extra => {
    expect((await POST(request(extra))).status).toBe(400); expect(db.transaction).not.toHaveBeenCalled();
  });
  it("still fails closed in production without a verified limiter", async () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("APP_URL", "https://toprank.test");
    const req = request(); req.headers.set("origin", "https://toprank.test");
    expect((await POST(req)).status).toBe(503); expect(db.transaction).not.toHaveBeenCalled();
  });
});
