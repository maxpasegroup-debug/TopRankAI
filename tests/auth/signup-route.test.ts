import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashSessionToken, SESSION_COOKIE } from "@/server/auth/session";
import { verifyPassword } from "@/server/auth/password";
import { POST } from "@/app/api/auth/signup/route";
import { ACCOUNT_POLICY_VERSION } from "@/shared/account-policy";

const mocks = vi.hoisted(() => ({
  findUser: vi.fn(),
  transaction: vi.fn(),
  createUser: vi.fn(),
  createStudentProfile: vi.fn(),
  createParentProfile: vi.fn(),
  createTeacherProfile: vi.fn(),
  createSession: vi.fn(),
  consume: vi.fn(),
  consent: vi.fn(),
  grant: vi.fn(),
  claimGrant: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    user: { findUnique: mocks.findUser },
    $transaction: mocks.transaction,
    session: { create: mocks.createSession },
  },
}));

vi.mock("@/server/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
vi.mock("@/server/auth/rate-limit", () => ({ authRateLimiter: { consume: mocks.consume } }));

const signup = { name: "Rahul", email: "RAHUL@example.com", password: "password123", country: "IN", ageBand: "18_PLUS", termsAccepted: true, privacyAccepted: true, termsVersion: ACCOUNT_POLICY_VERSION, privacyVersion: ACCOUNT_POLICY_VERSION };
const requestId = "signup-test";

function request(payload: Record<string, unknown>, query = "") {
  return new Request(`http://localhost/api/auth/signup${query}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": requestId, origin: "http://localhost", "x-toprank-client-ip": "192.0.2.1" },
    body: JSON.stringify(payload),
  });
}

describe("public signup API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("APP_URL", "http://localhost");
    vi.stubEnv("AUTH_TRUSTED_PROXY_VERIFIED", "true");
    vi.stubEnv("AUTH_TRUSTED_CLIENT_HEADER", "x-toprank-client-ip");
    vi.stubEnv("ACCOUNT_POLICY_REVIEWED", "true");
    vi.stubEnv("AUTH_CONSENT_HMAC_KEY", "test-only-consent-key-".repeat(3));
    mocks.consume.mockResolvedValue({ allowed: true });
    mocks.findUser.mockResolvedValue(null);
    mocks.createUser.mockImplementation(async ({ data }) => ({ id: "student_1", ...data }));
    mocks.createStudentProfile.mockResolvedValue({ userId: "student_1" });
    mocks.createSession.mockResolvedValue({});
    mocks.transaction.mockImplementation((callback) => callback({
      user: { create: mocks.createUser },
      studentProfile: { create: mocks.createStudentProfile },
      parentProfile: { create: mocks.createParentProfile },
      teacherProfile: { create: mocks.createTeacherProfile },
      accountConsent: { upsert: mocks.consent },
      session: { create: mocks.createSession },
      guardianRegistrationGrant: { findFirst: mocks.grant, updateMany: mocks.claimGrant },
      auditEvent: { create: mocks.audit },
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    { label: "explicit STUDENT", payload: { ...signup, role: "STUDENT" }, query: "" },
    { label: "missing role defaults to STUDENT", payload: signup, query: "" },
    { label: "query role cannot override STUDENT", payload: signup, query: "?role=PLATFORM_ADMIN" },
  ])("registers a student: $label", async ({ payload, query }) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "https://toprank.test");
    const browserRequest = request(payload, query);
    browserRequest.headers.set("origin", "https://toprank.test");
    const response = await POST(browserRequest);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      ok: true,
      data: { user: { id: "student_1", email: "rahul@example.com", name: "Rahul", role: "STUDENT" } },
      requestId,
    });
    expect(mocks.findUser).toHaveBeenCalledWith({ where: { email: "rahul@example.com" } });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.createUser).toHaveBeenCalledTimes(1);
    const data = mocks.createUser.mock.calls[0][0].data;
    expect(data).toEqual({ email: "rahul@example.com", name: "Rahul", role: "STUDENT", passwordHash: expect.any(String) });
    expect(data.passwordHash).not.toBe(signup.password);
    expect(await verifyPassword(signup.password, data.passwordHash)).toBe(true);
    expect(mocks.createStudentProfile).toHaveBeenCalledExactlyOnceWith({ data: { userId: "student_1" } });
    expect(mocks.createParentProfile).not.toHaveBeenCalled();
    expect(mocks.createTeacherProfile).not.toHaveBeenCalled();

    const cookie = response.cookies.get(SESSION_COOKIE);
    expect(cookie).toBeDefined();
    expect(cookie?.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(mocks.createSession).toHaveBeenCalledExactlyOnceWith({
      data: { userId: "student_1", tokenHash: hashSessionToken(cookie!.value), expiresAt: expect.any(Date) },
    });
    const expiresAt = mocks.createSession.mock.calls[0][0].data.expiresAt as Date;
    expect(expiresAt.getTime() - Date.now()).toBeGreaterThan(13 * 24 * 60 * 60 * 1000);
    expect(expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(14 * 24 * 60 * 60 * 1000);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=lax");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("Expires=");
  });

  it.each(["PLATFORM_ADMIN", "TEACHER", "PARENT", "SCHOOL_ADMIN", "ADMIN", "", null, { role: "STUDENT" }])(
    "rejects manipulated body role %j before any persistence",
    async (role) => {
      const response = await POST(request({ ...signup, role }));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "Request validation failed" },
        requestId,
      });
      expect(response.headers.get("set-cookie")).toBeNull();
      expect(mocks.findUser).not.toHaveBeenCalled();
      expect(mocks.transaction).not.toHaveBeenCalled();
      expect(mocks.createUser).not.toHaveBeenCalled();
      expect(mocks.createStudentProfile).not.toHaveBeenCalled();
      expect(mocks.createParentProfile).not.toHaveBeenCalled();
      expect(mocks.createTeacherProfile).not.toHaveBeenCalled();
      expect(mocks.createSession).not.toHaveBeenCalled();
    },
  );

  it("preserves the existing duplicate-email conflict without creating records", async () => {
    mocks.findUser.mockResolvedValue({ id: "existing_1" });
    const response = await POST(request(signup));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      ok: false,
      error: { code: "CONFLICT", message: "An account with this email already exists" },
      requestId,
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it.each(["UNDER_13", "13_TO_17"])("registers %s only with a matched single-use guardian approval", async ageBand => {
    mocks.grant.mockResolvedValue({ id: "grant1" }); mocks.claimGrant.mockResolvedValue({ count: 1 });
    const response = await POST(request({ ...signup, ageBand, guardianApproval: "a".repeat(43) }));
    expect(response.status).toBe(201); expect(mocks.createUser).toHaveBeenCalledOnce();
    expect(mocks.consent).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ guardianGrantId: "grant1", ageBand }) }));
    expect(mocks.claimGrant).toHaveBeenCalledOnce(); expect(mocks.createSession).toHaveBeenCalledOnce();
  });
  it.each(["missing", "invalid", "replayed"])("rejects %s guardian approval before user/profile/session creation", async failure => {
    mocks.grant.mockResolvedValue(failure === "invalid" ? null : { id: "grant1" }); mocks.claimGrant.mockResolvedValue({ count: 0 });
    const response = await POST(request({ ...signup, ageBand: "UNDER_13", ...(failure === "missing" ? {} : { guardianApproval: "a".repeat(43) }) }));
    expect(response.status).toBe(400); expect(mocks.createUser).not.toHaveBeenCalled(); expect(mocks.createStudentProfile).not.toHaveBeenCalled(); expect(mocks.createSession).not.toHaveBeenCalled(); expect(mocks.consent).not.toHaveBeenCalled(); expect(response.headers.get("set-cookie")).toBeNull();
  });
  it("rejects missing or stale legal acceptance before database lookup", async () => {
    for (const extra of [{ termsAccepted: false }, { privacyVersion: "old" }]) expect((await POST(request({ ...signup, ...extra }))).status).toBe(400);
    expect(mocks.findUser).not.toHaveBeenCalled(); expect(mocks.createSession).not.toHaveBeenCalled();
  });
});
