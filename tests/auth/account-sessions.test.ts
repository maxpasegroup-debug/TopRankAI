import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_POLICY_VERSION } from "@/shared/account-policy";
import { getCurrentUser, hashSessionToken, requireAuth } from "@/server/auth/session";
const mocks = vi.hoisted(() => ({ cookies: vi.fn(), findSession: vi.fn(), receipt: vi.fn(), redirect: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/server/db", () => ({ prisma: { session: { findFirst: mocks.findSession }, accountConsent: { findUnique: mocks.receipt } } }));
const user = { id: "s1", email: "s@example.com", name: "Student", role: "STUDENT", status: "ACTIVE" };
beforeEach(() => { vi.resetAllMocks(); mocks.cookies.mockResolvedValue({ get: () => ({ value: "a".repeat(43) }) }); mocks.findSession.mockResolvedValue({ user }); mocks.receipt.mockResolvedValue({ ageBand: "18_PLUS", termsVersion: ACCOUNT_POLICY_VERSION, privacyVersion: ACCOUNT_POLICY_VERSION, revokedAt: null }); mocks.redirect.mockImplementation((url: string) => { throw new Error("redirect:" + url); }); });
afterEach(() => vi.unstubAllEnvs());
describe("fresh legal consent session enforcement (mocked DB)", () => {
  it("queries only active unexpired hashed sessions", async () => { expect(await getCurrentUser()).toMatchObject({ id: user.id, requiresLegalConsent: false }); expect(mocks.findSession).toHaveBeenCalledWith(expect.objectContaining({ where: { tokenHash: hashSessionToken("a".repeat(43)), revokedAt: null, expiresAt: { gt: expect.any(Date) }, user: { status: "ACTIVE" } } })); });
  it("rejects missing cookies without database access", async () => { mocks.cookies.mockResolvedValue({ get: () => undefined }); expect(await getCurrentUser()).toBeNull(); expect(mocks.findSession).not.toHaveBeenCalled(); });
  it("rejects expired/revoked sessions before checking legal records", async () => { mocks.findSession.mockResolvedValue(null); expect(await getCurrentUser()).toBeNull(); expect(mocks.receipt).not.toHaveBeenCalled(); });
  it("rechecks revocation on the next request", async () => { expect(await getCurrentUser()).not.toBeNull(); mocks.receipt.mockResolvedValue({ ageBand: "18_PLUS", revokedAt: new Date(), termsVersion: ACCOUNT_POLICY_VERSION, privacyVersion: ACCOUNT_POLICY_VERSION }); expect(await getCurrentUser()).toBeNull(); expect(mocks.receipt).toHaveBeenCalledTimes(2); });
  it("legacy students can access only consent renewal until accepted", async () => { mocks.receipt.mockResolvedValue(null); expect(await getCurrentUser()).toBeNull(); expect(await getCurrentUser(true)).toMatchObject({ requiresLegalConsent: true }); await expect(requireAuth()).rejects.toThrow("redirect:/account/consent"); });
  it("preserves staff provisioning/session behavior", async () => { mocks.findSession.mockResolvedValue({ user: { ...user, role: "PLATFORM_ADMIN" } }); expect(await getCurrentUser()).toMatchObject({ role: "PLATFORM_ADMIN", requiresLegalConsent: false }); expect(mocks.receipt).not.toHaveBeenCalled(); });
  it("requires parents to accept their own current adult account policies", async () => {
    mocks.findSession.mockResolvedValue({ user: { ...user, role: "PARENT" } });
    expect(await getCurrentUser()).toMatchObject({ role: "PARENT", requiresLegalConsent: false });
    mocks.receipt.mockResolvedValue(null); expect(await getCurrentUser()).toBeNull();
    expect(await getCurrentUser(true)).toMatchObject({ role: "PARENT", requiresLegalConsent: true });
  });
  it("cannot use a minor guardian receipt to obtain parent workspace access", async () => {
    mocks.findSession.mockResolvedValue({ user: { ...user, role: "PARENT" } });
    mocks.receipt.mockResolvedValue({ ageBand: "UNDER_13", termsVersion: ACCOUNT_POLICY_VERSION, privacyVersion: ACCOUNT_POLICY_VERSION, revokedAt: null });
    expect(await getCurrentUser()).toBeNull();
  });
});
