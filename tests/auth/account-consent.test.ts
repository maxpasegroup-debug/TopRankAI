import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_POLICY_VERSION, needsGuardian } from "@/shared/account-policy";
import { accountConsentSchema, newPasswordSchema, signupSchema } from "@/server/auth/validation";
import { acceptAccountConsent, assertAccountPolicyReady, childEmailHash, isConsentCurrent, issueGuardianApproval, revokeGuardianApproval, saveAccountConsent, verifyAdultAccount, withdrawAccountConsent } from "@/server/auth/account-consent";
import type { Prisma } from "@/generated/prisma/client";
import { adultConsentWhere } from "@/server/auth/sharing";
const sharing = vi.hoisted(() => ({ resets: vi.fn(), achievements: vi.fn(), entries: vi.fn(), relationships: vi.fn(), enrollments: vi.fn() }));
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), findUser: vi.fn(), findGrant: vi.fn(), claim: vi.fn(), createGrant: vi.fn(), updateGrant: vi.fn(), receipt: vi.fn(), upsert: vi.fn(), updateReceipt: vi.fn(), updateReceipts: vi.fn(), sessions: vi.fn(), audit: vi.fn() }));
vi.mock("@/server/db", () => ({ prisma: { $transaction: mocks.transaction } }));
const tx = { user: { findFirst: mocks.findUser }, guardianRegistrationGrant: { findFirst: mocks.findGrant, updateMany: mocks.claim, create: mocks.createGrant, update: mocks.updateGrant },
  accountConsent: { findUnique: mocks.receipt, upsert: mocks.upsert, update: mocks.updateReceipt, updateMany: mocks.updateReceipts }, session: { updateMany: mocks.sessions }, auditEvent: { create: mocks.audit },
  passwordReset: { updateMany: sharing.resets }, earnedAchievement: { updateMany: sharing.achievements }, competitionEntry: { updateMany: sharing.entries },
  studentParentRelationship: { updateMany: sharing.relationships }, schoolEnrollment: { updateMany: sharing.enrollments } };
const student = { id: "s1", role: "STUDENT" as const, email: "s@example.com", name: "Student" };
const parent = { ...student, id: "p1", role: "PARENT" as const };
const admin = { ...student, id: "a1", role: "PLATFORM_ADMIN" as const };
const input = { country: "IN", ageBand: "18_PLUS", termsAccepted: true, privacyAccepted: true, termsVersion: ACCOUNT_POLICY_VERSION, privacyVersion: ACCOUNT_POLICY_VERSION } as const;
const minor = { ...input, ageBand: "UNDER_13" as const, guardianApproval: "a".repeat(43) };
const active = () => ({ termsVersion: ACCOUNT_POLICY_VERSION, privacyVersion: ACCOUNT_POLICY_VERSION, revokedAt: null, ageBand: "18_PLUS" });
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("AUTH_CONSENT_HMAC_KEY", "test-only-key-".repeat(4)); vi.stubEnv("ACCOUNT_GUARDIAN_VERIFICATION_APPROVED", "true"); mocks.transaction.mockImplementation(fn => fn(tx)); mocks.claim.mockResolvedValue({ count: 1 }); mocks.findGrant.mockResolvedValue({ id: "g1" }); mocks.findUser.mockResolvedValue({ id: parent.id }); mocks.createGrant.mockResolvedValue({ id: "g1" }); });
beforeEach(() => vi.stubEnv("ACCOUNT_POLICY_REVIEWED", "true"));
afterEach(() => vi.unstubAllEnvs());
describe("student consent and guardian registration (mocked database)", () => {
  it.each(["UNDER_13", "13_TO_17"] as const)("supports %s through guardian authorization rather than exclusion", age => expect(needsGuardian(age)).toBe(true));
  it("allows adults without guardian controls", () => expect(needsGuardian("18_PLUS")).toBe(false));
  it.each(["country", "ageBand", "termsAccepted", "privacyAccepted", "termsVersion", "privacyVersion"])("requires %s", field => { const value = { ...input } as Record<string, unknown>; delete value[field]; expect(accountConsentSchema.safeParse(value).success).toBe(false); });
  it("rejects missing minor authorization and unknown public role", () => {
    const credentials = { name: "Student", email: student.email, password: "password123" };
    expect(signupSchema.safeParse({ ...credentials, ...input, ageBand: "UNDER_13" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...credentials, ...input, role: "PARENT" }).success).toBe(false);
  });
  it("rejects stale policies, implicit acceptance and unsupported country", () => {
    for (const extra of [{ termsAccepted: false }, { privacyAccepted: "true" }, { termsVersion: "old" }, { country: "UNKNOWN" }]) expect(accountConsentSchema.safeParse({ ...input, ...extra }).success).toBe(false);
  });
  it("checks bcrypt's UTF-8 byte limit for new passwords", () => { expect(newPasswordSchema.safeParse("x".repeat(72)).success).toBe(true); expect(newPasswordSchema.safeParse("x".repeat(73)).success).toBe(false); expect(newPasswordSchema.safeParse("\u00e9".repeat(37)).success).toBe(false); });
  it("fails closed on unreviewed production policy", () => { vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("ACCOUNT_POLICY_REVIEWED", "false"); expect(assertAccountPolicyReady).toThrow(); });
  it("keys and normalizes child-email bindings", () => { expect(childEmailHash("S@EXAMPLE.COM")).toBe(childEmailHash(student.email)); expect(childEmailHash(student.email)).toMatch(/^[a-f0-9]{64}$/); vi.stubEnv("AUTH_CONSENT_HMAC_KEY", ""); expect(() => childEmailHash(student.email)).toThrow(); });
  it("requires a current receipt, not just an authenticated session", () => {
    expect(isConsentCurrent(null)).toBe(false); expect(isConsentCurrent(active())).toBe(true);
    expect(isConsentCurrent({ ...active(), revokedAt: new Date() })).toBe(false); expect(isConsentCurrent({ ...active(), privacyVersion: "old" })).toBe(false);
    expect(isConsentCurrent({ ...active(), ageBand: "UNDER_13" })).toBe(false);
  });
  it.each(["revoked", "unused", "inactive", "outdated"])("rejects %s guardian consent on subsequent access", failure => {
    const grant = { revokedAt: null as Date | null, usedAt: new Date() as Date | null, policyVersion: ACCOUNT_POLICY_VERSION, guardian: { status: "ACTIVE", role: "PARENT", accountConsent: active() } };
    expect(isConsentCurrent({ ...active(), ageBand: "UNDER_13", guardianGrant: grant })).toBe(true);
    if (failure === "revoked") grant.revokedAt = new Date(); if (failure === "unused") grant.usedAt = null; if (failure === "inactive") grant.guardian.status = "SUSPENDED"; if (failure === "outdated") grant.policyVersion = "old";
    expect(isConsentCurrent({ ...active(), ageBand: "UNDER_13", guardianGrant: grant })).toBe(false);
  });
  it("stores explicit adult acceptance without guardian grants", async () => { await saveAccountConsent(tx as unknown as Prisma.TransactionClient, student.id, student.email, input); expect(mocks.findGrant).not.toHaveBeenCalled(); expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ userId: student.id, country: "IN", ageBand: "18_PLUS", termsVersion: ACCOUNT_POLICY_VERSION }) })); });
  it("binds a minor grant to email, country, policy, expiry and active verified parent", async () => {
    await saveAccountConsent(tx as unknown as Prisma.TransactionClient, student.id, student.email, minor);
    expect(mocks.findGrant).toHaveBeenCalledWith({ where: expect.objectContaining({ childEmailHash: childEmailHash(student.email), country: "IN", usedAt: null, revokedAt: null, policyVersion: ACCOUNT_POLICY_VERSION, expiresAt: { gt: expect.any(Date) }, guardian: { role: "PARENT", status: "ACTIVE", accountConsent: { is: adultConsentWhere() } } }) });
    expect(mocks.claim).toHaveBeenCalledOnce(); expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ guardianGrantId: "g1" }) }));
  });
  it.each(["missing", "replay"])("rejects %s grant before consent/session creation", async failure => {
    if (failure === "missing") mocks.findGrant.mockResolvedValue(null); else mocks.claim.mockResolvedValue({ count: 0 });
    await expect(saveAccountConsent(tx as unknown as Prisma.TransactionClient, student.id, student.email, minor)).rejects.toThrow(); expect(mocks.upsert).not.toHaveBeenCalled(); expect(mocks.sessions).not.toHaveBeenCalled();
  });
  it("does not permit an age assertion to remove an existing child's protections", async () => { mocks.receipt.mockResolvedValue({ ageBand: "UNDER_13" }); await expect(acceptAccountConsent(student, input)).rejects.toThrow(); expect(mocks.upsert).not.toHaveBeenCalled(); });
  it("withdrawal revokes consent and all sessions in the same transaction", async () => { await withdrawAccountConsent(student); expect(mocks.updateReceipts).toHaveBeenCalledWith({ where: { userId: student.id, revokedAt: null }, data: { revokedAt: expect.any(Date) } }); expect(mocks.sessions).toHaveBeenCalledWith({ where: { userId: student.id, revokedAt: null }, data: { revokedAt: expect.any(Date) } }); expect(mocks.audit).toHaveBeenCalledOnce(); });
  it("withdrawal invalidates recovery, public links, rankings and existing portal sharing atomically", async () => {
    await withdrawAccountConsent(student);
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(sharing.resets).toHaveBeenCalledWith({ where: { userId: student.id, consumedAt: null }, data: { consumedAt: expect.any(Date), deliveryPayload: null } });
    expect(sharing.achievements).toHaveBeenCalledWith({ where: { userId: student.id, shareHash: { not: null } }, data: { shareHash: null, version: { increment: 1 } } });
    expect(sharing.entries).toHaveBeenCalledWith({ where: { userId: student.id, visible: true }, data: { visible: false } });
    expect(sharing.relationships).toHaveBeenCalledWith(expect.objectContaining({ where: { studentUserId: student.id, status: { in: ["PENDING", "ACTIVE"] } }, data: expect.objectContaining({ status: "REVOKED", studentConsentAt: null, parentAcceptedAt: null }) }));
    expect(sharing.enrollments).toHaveBeenCalledWith(expect.objectContaining({ where: { studentId: student.id, status: { in: ["PENDING", "ACTIVE"] } }, data: expect.objectContaining({ status: "REVOKED", studentConsentAt: null }) }));
  });
  it("guardian withdrawal invalidates dependent access and all of that guardian's grants", async () => {
    await withdrawAccountConsent(parent);
    expect(mocks.sessions).toHaveBeenCalledTimes(2);
    expect(mocks.sessions).toHaveBeenLastCalledWith(expect.objectContaining({ where: { user: { is: { role: "STUDENT", accountConsent: { is: { guardianGrant: { is: { guardianId: parent.id } } } } } }, revokedAt: null } }));
    expect(mocks.claim).toHaveBeenCalledWith({ where: { guardianId: parent.id, revokedAt: null }, data: { revokedAt: expect.any(Date) } });
    expect(sharing.relationships).toHaveBeenLastCalledWith(expect.objectContaining({ where: { parentUserId: parent.id, status: { in: ["PENDING", "ACTIVE"] } } }));
    expect(mocks.audit).toHaveBeenCalledOnce();
  });
  it.each(["missing", "revoked", "outdated", "minor"])("denies child access when guardian own consent is %s", failure => {
    const receipt = active();
    const guardianReceipt = failure === "missing" ? null : { ...receipt, ...(failure === "revoked" ? { revokedAt: new Date() } : failure === "outdated" ? { termsVersion: "old" } : { ageBand: "UNDER_13" }) };
    expect(isConsentCurrent({ ...receipt, ageBand: "UNDER_13", guardianGrant: { revokedAt: null, usedAt: new Date(), policyVersion: ACCOUNT_POLICY_VERSION, guardian: { status: "ACTIVE", role: "PARENT", accountConsent: guardianReceipt } } })).toBe(false);
  });
  it("does not permit a parent to assert minor status", async () => {
    await expect(acceptAccountConsent(parent, minor)).rejects.toThrow();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("only approved platform staff may issue verified guardian codes", async () => {
    const grantInput = { guardianId: parent.id, childEmail: student.email, country: "IN" as const, verificationReference: "reviewed-evidence-1", guardianIdentityAndAuthorityVerified: true as const, guardianConsentRecorded: true as const };
    await expect(issueGuardianApproval(parent, grantInput)).rejects.toThrow(); expect(mocks.createGrant).not.toHaveBeenCalled();
    vi.stubEnv("ACCOUNT_GUARDIAN_VERIFICATION_APPROVED", "false"); await expect(issueGuardianApproval(admin, grantInput)).rejects.toThrow(); expect(mocks.createGrant).not.toHaveBeenCalled();
    vi.stubEnv("ACCOUNT_GUARDIAN_VERIFICATION_APPROVED", "true"); const result = await issueGuardianApproval(admin, grantInput); expect(result.approval).toMatch(/^[A-Za-z0-9_-]{43}$/); expect(mocks.createGrant.mock.calls[0][0].data.tokenHash).not.toBe(result.approval); expect(mocks.audit).toHaveBeenCalledOnce();
  });
  it("guardian revocation scopes ownership and rechecks the receipt after locking the grant", async () => { mocks.receipt.mockResolvedValue({ userId: student.id }); await revokeGuardianApproval(parent, "g1"); expect(mocks.findGrant).toHaveBeenCalledWith({ where: { id: "g1", guardianId: parent.id } }); expect(mocks.receipt).toHaveBeenCalledWith({ where: { guardianGrantId: "g1" } }); expect(mocks.sessions).toHaveBeenCalledOnce(); });
  it("cannot revoke another guardian's grant", async () => { mocks.findGrant.mockResolvedValue(null); await expect(revokeGuardianApproval(parent, "other")).rejects.toThrow(); expect(mocks.updateGrant).not.toHaveBeenCalled(); });
  it("requires reviewed adulthood verification and renewed consent instead of permanent guardian controls", async () => {
    const verification = { studentId: student.id, verificationReference: "reviewed-adulthood-1", adultIdentityVerified: true as const };
    await expect(verifyAdultAccount(parent, verification)).rejects.toThrow();
    expect(mocks.updateReceipt).not.toHaveBeenCalled();
    mocks.receipt.mockResolvedValue({ ageBand: "13_TO_17", guardianGrantId: "g1" });
    await expect(verifyAdultAccount(admin, verification)).resolves.toEqual({ verified: true, requiresRenewedConsent: true });
    expect(mocks.updateReceipt).toHaveBeenCalledWith({ where: { userId: student.id }, data: { ageBand: "18_PLUS", guardianGrantId: null, revokedAt: expect.any(Date) } });
    expect(mocks.sessions).toHaveBeenCalledOnce();
    expect(mocks.audit).toHaveBeenCalledOnce();
  });
});
