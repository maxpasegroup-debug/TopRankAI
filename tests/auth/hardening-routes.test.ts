import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as signup } from "@/app/api/auth/signup/route";
import { GET as getLogout, POST as logout } from "@/app/api/auth/logout/route";
import { hashSessionToken, SESSION_COOKIE } from "@/server/auth/session";
import { ACCOUNT_POLICY_VERSION } from "@/shared/account-policy";

const mocks = vi.hoisted(() => ({
  findUser: vi.fn(), createSession: vi.fn(), revoke: vi.fn(), transaction: vi.fn(),
  verify: vi.fn(), cookies: vi.fn(), consume: vi.fn(), limiterEnabled: true,
}));
vi.mock("@/server/db", () => ({ prisma: {
  user: { findUnique: mocks.findUser }, session: { create: mocks.createSession, updateMany: mocks.revoke },
  $transaction: mocks.transaction,
} }));
vi.mock("@/server/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
vi.mock("@/server/auth/password", () => ({ verifyPassword: mocks.verify, hashPassword: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/server/auth/rate-limit", () => ({
  get authRateLimiter() { return mocks.limiterEnabled ? { consume: mocks.consume } : null; },
}));

const credentials = { email: "student@example.com", password: "password123" };
const signupFields = { name: "Student", country: "IN", ageBand: "18_PLUS", termsAccepted: true, privacyAccepted: true, termsVersion: ACCOUNT_POLICY_VERSION, privacyVersion: ACCOUNT_POLICY_VERSION };
function request(path: string, body: unknown = credentials, headers: Record<string, string> = {}) {
  return new Request(`http://internal/api/auth/${path}`, {
    method: "POST", headers: { origin: "https://toprank.test", "content-type": "application/json", "x-toprank-client-ip": "192.0.2.1", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("APP_URL", "https://toprank.test");
  vi.stubEnv("AUTH_TRUSTED_PROXY_VERIFIED", "true");
  vi.stubEnv("AUTH_TRUSTED_CLIENT_HEADER", "x-toprank-client-ip");
  mocks.limiterEnabled = true;
  mocks.consume.mockResolvedValue({ allowed: true });
  mocks.findUser.mockResolvedValue({ id: "student1", ...credentials, name: "Student", role: "STUDENT", status: "ACTIVE", passwordHash: "private-hash" });
  mocks.verify.mockResolvedValue(true);
  mocks.cookies.mockResolvedValue({ get: () => ({ value: "private-session-token" }) });
});
afterEach(() => vi.unstubAllEnvs());

function expectNoPersistence() {
  expect(mocks.findUser).not.toHaveBeenCalled();
  expect(mocks.transaction).not.toHaveBeenCalled();
  expect(mocks.createSession).not.toHaveBeenCalled();
  expect(mocks.revoke).not.toHaveBeenCalled();
}

describe("signup/login hardening with mocked persistence and limiter", () => {
  it.each([["login", login], ["signup", signup]] as const)("%s fails closed without limiter", async (path, handler) => {
    mocks.limiterEnabled = false;
    const response = await handler(request(path));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "AUTH_UNAVAILABLE", message: "Authentication is temporarily unavailable" } });
    expectNoPersistence();
  });
  it.each([["login", login], ["signup", signup]] as const)("%s enforces throttle before DB or hashing", async (path, handler) => {
    mocks.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 15.1 });
    const response = await handler(request(path));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("16");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(mocks.consume).toHaveBeenCalledWith(path);
    expect(mocks.verify).not.toHaveBeenCalled();
    expectNoPersistence();
  });
  it("repeated login abuse is stopped and a later window recovers (test-only limiter)", async () => {
    let time = 0;
    let attempts = 0;
    mocks.consume.mockImplementation(async (_action, identity) => {
      if (identity) return { allowed: true };
      if (time >= 60) attempts = 0;
      return ++attempts <= 2 ? { allowed: true } : { allowed: false, retryAfterSeconds: 60 };
    });
    mocks.verify.mockResolvedValue(false);
    expect((await login(request("login"))).status).toBe(401);
    expect((await login(request("login", credentials, { "x-forwarded-for": "1.2.3.4" }))).status).toBe(401);
    expect((await login(request("login", credentials, { "x-forwarded-for": "5.6.7.8" }))).status).toBe(429);
    expect(mocks.findUser).toHaveBeenCalledTimes(2);
    expect(mocks.createSession).not.toHaveBeenCalled();
    time = 60;
    mocks.verify.mockResolvedValue(true);
    const response = await login(request("login"));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(await response.json()).toMatchObject({ data: { user: { role: "STUDENT" } } });
    expect(mocks.createSession).toHaveBeenCalledOnce();
  });
  it.each([["login", login], ["signup", signup]] as const)("%s rejects unsafe bodies with no database access", async (path, handler) => {
    for (const [body, status] of [["x".repeat(4097), 413], ["{", 400], ["null", 400], ["{}", 400]] as const) {
      const response = await handler(request(path, body));
      expect(response.status).toBe(status);
      const text = await response.text();
      expect(text).not.toMatch(/stack|passwordHash|private|SyntaxError/);
      expect(response.headers.get("set-cookie")).toBeNull();
      expectNoPersistence();
    }
  });
  it.each([["login", login], ["signup", signup], ["logout", logout]] as const)("%s rejects cross-origin mutation before any work", async (path, handler) => {
    const response = await handler(request(path, credentials, { origin: "https://evil.test" }));
    expect(response.status).toBe(403);
    expect(mocks.consume).not.toHaveBeenCalled();
    expect(mocks.cookies).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toBeNull();
    expectNoPersistence();
  });
  it("limiter errors are sanitized and do not fall through", async () => {
    mocks.consume.mockRejectedValue(new Error("secret connection details"));
    const response = await login(request("login"));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("secret");
    expectNoPersistence();
  });
  it.each([["login", login], ["signup", signup]] as const)("%s cannot bypass an identity denial", async (path, handler) => {
    mocks.consume.mockResolvedValueOnce({ allowed: true }).mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 30 });
    const response = await handler(request(path, { ...signupFields, ...credentials }));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("30");
    expectNoPersistence();
  });
  it("ignores spoofed forwarding headers and requires verified ingress", async () => {
    vi.stubEnv("AUTH_TRUSTED_PROXY_VERIFIED", "false");
    const response = await login(request("login", credentials, { "x-forwarded-for": "192.0.2.99" }));
    expect(response.status).toBe(503);
    expectNoPersistence();
  });
  it.each([["login", login], ["signup", signup]] as const)("%s cannot bypass identity provider failure", async (path, handler) => {
    mocks.consume.mockResolvedValueOnce({ allowed: true }).mockRejectedValueOnce(new Error("private provider detail"));
    const response = await handler(request(path, { ...signupFields, ...credentials }));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private");
    expectNoPersistence();
  });
  it("rejects requests missing the reserved client header rather than falling back to forwarded IP", async () => {
    const req = request("login", credentials, { "x-forwarded-for": "192.0.2.1" });
    req.headers.delete("x-toprank-client-ip");
    expect((await login(req)).status).toBe(503);
    expectNoPersistence();
  });
});

describe("POST-only logout", () => {
  it("GET never reads cookies, revokes sessions, or clears a cookie", async () => {
    const response = await getLogout(new Request("https://toprank.test/api/auth/logout"));
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(mocks.cookies).not.toHaveBeenCalled();
    expectNoPersistence();
  });
  it("valid POST revokes the hashed current token and clears the secure cookie", async () => {
    const response = await logout(request("logout"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { loggedOut: true } });
    expect(mocks.revoke).toHaveBeenCalledWith({
      where: { tokenHash: hashSessionToken("private-session-token"), revokedAt: null }, data: { revokedAt: expect.any(Date) },
    });
    expect(response.headers.get("set-cookie")).toContain(`${SESSION_COOKIE}=;`);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
  });
  it("HTML form logout redirects with 303 so the browser follows with GET", async () => {
    const response = await logout(request("logout", "", { accept: "text/html", referer: "https://toprank.test/settings" }));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://toprank.test/login");
    expect(mocks.revoke).toHaveBeenCalledOnce();
  });
  it("logout is idempotent without a session cookie", async () => {
    mocks.cookies.mockResolvedValue({ get: () => undefined });
    const response = await logout(request("logout"));
    expect(response.status).toBe(200);
    expect(mocks.revoke).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
  it("rejects missing Origin and Referer without touching the session", async () => {
    const req = request("logout");
    req.headers.delete("origin");
    const response = await logout(req);
    expect(response.status).toBe(403);
    expect(mocks.cookies).not.toHaveBeenCalled();
    expect(mocks.revoke).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toBeNull();
  });
  it("supports the existing same-origin form with only Referer", async () => {
    const req = request("logout", "", { accept: "text/html", referer: "https://toprank.test/settings" });
    req.headers.delete("origin");
    const response = await logout(req);
    expect(response.status).toBe(303);
    expect(mocks.revoke).toHaveBeenCalledOnce();
  });
});
