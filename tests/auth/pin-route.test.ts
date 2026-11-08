import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/auth/pin/route";
import { ApiError } from "@/server/api/errors";
import { ACCOUNT_POLICY_VERSION } from "@/shared/account-policy";
const service = vi.hoisted(() => ({ ready: vi.fn(), request: vi.fn(), verify: vi.fn(), signup: vi.fn(), reset: vi.fn(), login: vi.fn(), consume: vi.fn() }));
vi.mock("@/server/db", () => ({ prisma: {} }));
vi.mock("@/server/logger", () => ({ logger: { error: vi.fn(), info: vi.fn() } }));
vi.mock("@/server/auth/rate-limit", () => ({ authRateLimiter: { consume: service.consume } }));
vi.mock("@/server/auth/pin-auth", () => ({ assertPinReady: service.ready, requestPinOtp: service.request, verifyPinOtp: service.verify, finishPinSignup: service.signup, finishPinReset: service.reset, loginWithPin: service.login }));
const registration = { name: "Student", phone: "+919876543210", email: "student@example.com", country: "IN", ageBand: "18_PLUS", termsAccepted: true, privacyAccepted: true, termsVersion: ACCOUNT_POLICY_VERSION, privacyVersion: ACCOUNT_POLICY_VERSION };
function request(body: unknown, origin = "https://toprank.test") {
  return new Request("https://toprank.test/api/auth/pin", { method: "POST", headers: { origin, "content-type": "application/json", "x-toprank-client-ip": "192.0.2.1" }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("APP_URL", "https://toprank.test"); vi.stubEnv("AUTH_TRUSTED_PROXY_VERIFIED", "true"); vi.stubEnv("AUTH_TRUSTED_CLIENT_HEADER", "x-toprank-client-ip");
  service.consume.mockResolvedValue({ allowed: true }); service.request.mockResolvedValue({ challenge: "a".repeat(43), expiresIn: 600 });
});
afterEach(() => vi.unstubAllEnvs());
describe("PIN API boundaries (mocked persistence/provider service, real HTTP validation)", () => {
  it("checks readiness before calling a provider or database service", async () => {
    service.ready.mockImplementation(() => { throw new ApiError(503, "PIN_UNAVAILABLE", "PIN authentication is temporarily unavailable"); });
    expect((await POST(request({ action: "requestReset", email: "student@example.com" }))).status).toBe(503); expect(service.request).not.toHaveBeenCalled();
  });
  it("rejects cross-origin before work", async () => {
    expect((await POST(request({ action: "requestSignup", registration }, "https://attacker.test"))).status).toBe(403);
    expect(service.request).not.toHaveBeenCalled(); expect(service.consume).not.toHaveBeenCalled();
  });
  it("does not trust forged approval, status or role fields", async () => {
    for (const extra of [{ role: "PLATFORM_ADMIN" }, { emailVerified: true }, { status: "ACTIVE" }]) {
      expect((await POST(request({ action: "requestSignup", registration: { ...registration, ...extra } }))).status).toBe(400);
    }
    expect(service.request).not.toHaveBeenCalled();
  });
  it("passes only parsed registration and a normalized email to the service", async () => {
    const response = await POST(request({ action: "requestSignup", registration: { ...registration, email: "STUDENT@example.com" } }));
    expect(response.status).toBe(200); expect(service.request).toHaveBeenCalledWith("student@example.com", expect.objectContaining({ role: "STUDENT", email: "student@example.com" }));
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("applies identity throttling before mail/PIN verification", async () => {
    service.consume.mockResolvedValueOnce({ allowed: true }).mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 60 });
    const response = await POST(request({ action: "login", phone: registration.phone, pin: "482619" }));
    expect(response.status).toBe(429); expect(response.headers.get("retry-after")).toBe("60"); expect(service.login).not.toHaveBeenCalled();
  });
  it("rejects mismatched PIN confirmation before mutation", async () => {
    expect((await POST(request({ action: "reset", challenge: "a".repeat(43), proof: "b".repeat(43), pin: "482619", confirmPin: "482610" }))).status).toBe(400);
    expect(service.reset).not.toHaveBeenCalled();
  });
  it("keeps session tokens out of JSON and issues the existing secure HttpOnly cookie", async () => {
    service.login.mockResolvedValue({ user: { id: "student-1", role: "STUDENT" }, session: { token: "test-private-session", expiresAt: new Date(Date.now() + 100000) } });
    const response = await POST(request({ action: "login", phone: registration.phone, pin: "482619" }));
    expect(response.status).toBe(200); expect(await response.text()).not.toContain("test-private-session");
    expect(response.headers.get("set-cookie")).toMatch(/HttpOnly/); expect(response.headers.get("set-cookie")).toMatch(/Secure/);
  });
  it("clears the old session cookie after reset without automatically logging in", async () => {
    service.reset.mockResolvedValue({ reset: true });
    const response = await POST(request({ action: "reset", challenge: "a".repeat(43), proof: "b".repeat(43), pin: "482619", confirmPin: "482619" }));
    expect(response.status).toBe(200); expect(response.headers.get("set-cookie")).toContain("Max-Age=0"); expect(service.login).not.toHaveBeenCalled();
  });
  it("bounds body size before service work", async () => {
    expect((await POST(request({ action: "requestReset", email: "x".repeat(5000) }))).status).toBe(413); expect(service.request).not.toHaveBeenCalled();
  });
  it("does not expose provider or database errors", async () => {
    service.verify.mockRejectedValue(new Error("private-provider-detail"));
    const response = await POST(request({ action: "verify", challenge: "a".repeat(43), code: "123456" }));
    expect(response.status).toBe(500); expect(await response.text()).not.toContain("private-provider-detail");
  });
});
