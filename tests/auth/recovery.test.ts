import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decryptRecoveryPayload, deliverPasswordRecoveries, encryptRecoveryPayload, queuePasswordRecovery, readRecoveryConfig, RECOVERY_MESSAGE, resetPassword, RESET_DURATION_MS } from "@/server/auth/recovery";
import { hashSessionToken } from "@/server/auth/session";
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), user: vi.fn(), resets: vi.fn(), createReset: vi.fn(), findReset: vi.fn(), findMany: vi.fn(), updateUser: vi.fn(), sessions: vi.fn(), audit: vi.fn(), hash: vi.fn() }));
vi.mock("@/server/db", () => ({ prisma: { user: { findFirst: mocks.user }, $transaction: mocks.transaction, passwordReset: { findMany: mocks.findMany, updateMany: mocks.resets } } }));
vi.mock("@/server/auth/password", () => ({ hashPassword: mocks.hash }));
const tx = { passwordReset: { updateMany: mocks.resets, create: mocks.createReset, findFirst: mocks.findReset }, user: { update: mocks.updateUser }, session: { updateMany: mocks.sessions }, auditEvent: { create: mocks.audit } };
const config = { key: Buffer.alloc(32, 7), apiKey: "test-only-provider-key", from: "sender@example.com", appUrl: "https://toprank.test" };
const token = "a".repeat(43);
const payload = { email: "student@example.com", token };
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("AUTH_RECOVERY_DELIVERY_VERIFIED", "false"); mocks.transaction.mockImplementation(fn => fn(tx)); mocks.resets.mockResolvedValue({ count: 1 }); mocks.hash.mockResolvedValue("test-only-bcrypt-hash"); });
afterEach(() => vi.unstubAllEnvs());
describe("password recovery with mocked persistence and transport", () => {
  it("fails closed without delivery verification before database lookup", async () => { await expect(queuePasswordRecovery(payload.email)).rejects.toThrow("temporarily unavailable"); expect(mocks.user).not.toHaveBeenCalled(); });
  it("requires explicit provider, encryption key, sender and canonical origin", () => {
    vi.stubEnv("AUTH_RECOVERY_DELIVERY_VERIFIED", "true"); vi.stubEnv("AUTH_EMAIL_PROVIDER", "resend"); vi.stubEnv("AUTH_RECOVERY_ENCRYPTION_KEY", config.key.toString("base64")); vi.stubEnv("RESEND_API_KEY", config.apiKey); vi.stubEnv("AUTH_EMAIL_FROM", config.from); vi.stubEnv("APP_URL", config.appUrl);
    expect(readRecoveryConfig()).toEqual(config);
    for (const url of ["https://user:secret@toprank.test", "https://toprank.test/path", "https://toprank.test?anything=1", "http://remote.example"]) { vi.stubEnv("APP_URL", url); expect(readRecoveryConfig).toThrow(); }
  });
  it("stores authenticated ciphertext, not a plaintext email or token", () => { const encrypted = encryptRecoveryPayload(payload, "r1", config.key); expect(encrypted).not.toContain(payload.email); expect(encrypted).not.toContain(token); expect(decryptRecoveryPayload(encrypted, "r1", config.key)).toEqual(payload); });
  it.each(["different-id", "wrong-key", "modified-ciphertext"])("rejects %s without leaking the payload", failure => { let encrypted = encryptRecoveryPayload(payload, "r1", config.key); if (failure === "modified-ciphertext") encrypted = encrypted.slice(0, -5) + "abcde"; expect(() => decryptRecoveryPayload(encrypted, failure === "different-id" ? "r2" : "r1", failure === "wrong-key" ? Buffer.alloc(32, 8) : config.key)).toThrow("temporarily unavailable"); });
  it("unknown and known accounts return the same public response with no token", async () => {
    mocks.user.mockResolvedValue(null); const unknown = await queuePasswordRecovery(payload.email, config); expect(mocks.createReset).not.toHaveBeenCalled();
    mocks.user.mockResolvedValue({ id: "s1", email: payload.email }); const known = await queuePasswordRecovery(payload.email, config);
    expect(known).toEqual(unknown); expect(known).toEqual({ message: RECOVERY_MESSAGE }); expect(JSON.stringify(known)).not.toContain(token);
    const data = mocks.createReset.mock.calls[0][0].data; const decrypted = decryptRecoveryPayload(data.deliveryPayload, data.id, config.key);
    expect(data.tokenHash).toBe(hashSessionToken(decrypted.token)); expect(data.tokenHash).not.toBe(decrypted.token);
    expect(data.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(RESET_DURATION_MS); expect(mocks.transaction.mock.calls[0][1]).toEqual({ isolationLevel: "Serializable" });
  });
  it.each(["missing", "replayed"])("rejects %s recovery before changing credentials/sessions", async failure => {
    mocks.findReset.mockResolvedValue(failure === "missing" ? null : { id: "r1", userId: "s1" }); if (failure === "replayed") mocks.resets.mockResolvedValue({ count: 0 });
    await expect(resetPassword(token, "new-password")).rejects.toThrow("invalid or expired"); expect(mocks.updateUser).not.toHaveBeenCalled(); expect(mocks.sessions).not.toHaveBeenCalled();
  });
  it("checks expiry/status, atomically claims once, hashes the replacement and revokes all sessions", async () => {
    mocks.findReset.mockResolvedValue({ id: "r1", userId: "s1" }); expect(await resetPassword(token, "new-password")).toEqual({ reset: true });
    expect(mocks.findReset).toHaveBeenCalledWith({ where: expect.objectContaining({ tokenHash: hashSessionToken(token), consumedAt: null, expiresAt: { gt: expect.any(Date) }, deliveryState: "SENT", user: { role: "STUDENT", status: "ACTIVE" } }) });
    expect(mocks.updateUser).toHaveBeenCalledWith({ where: { id: "s1" }, data: { passwordHash: "test-only-bcrypt-hash" } }); expect(mocks.sessions).toHaveBeenCalledWith({ where: { userId: "s1", revokedAt: null }, data: { revokedAt: expect.any(Date) } }); expect(mocks.audit).toHaveBeenCalledOnce();
  });
  it("does not send without acquiring the bounded delivery lease", async () => { mocks.findMany.mockResolvedValue([{ id: "r1" }]); mocks.resets.mockResolvedValue({ count: 0 }); const send = vi.fn(); expect(await deliverPasswordRecoveries(5, config, send)).toEqual({ processed: 1, accepted: 0 }); expect(send).not.toHaveBeenCalled(); });
  it("delivers only to the fixed provider endpoint with redirect/timeout/idempotency safeguards", async () => {
    const row = { id: "r1", tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 60000), deliveryPayload: encryptRecoveryPayload(payload, "r1", config.key) }; mocks.findMany.mockResolvedValue([row]);
    const send = vi.fn().mockResolvedValue(new Response("accepted", { status: 200 })); expect(await deliverPasswordRecoveries(5, config, send)).toEqual({ processed: 1, accepted: 1 });
    expect(send).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({ method: "POST", redirect: "error", signal: expect.any(AbortSignal) }));
    const message = JSON.parse(send.mock.calls[0][1].body); expect(message.to).toEqual([payload.email]); expect(message.text).toContain("/reset-password#token=" + token);
    expect(mocks.resets).toHaveBeenLastCalledWith(expect.objectContaining({ data: { deliveryState: "SENT", deliveryPayload: null, deliveryLeaseUntil: null } }));
  });
  it("marks provider failure without returning its secret details", async () => { mocks.findMany.mockResolvedValue([{ id: "r1", tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 60000), deliveryPayload: encryptRecoveryPayload(payload, "r1", config.key) }]); const send = vi.fn().mockRejectedValue(new Error("secret provider detail")); expect(await deliverPasswordRecoveries(5, config, send)).toEqual({ processed: 1, accepted: 0 }); expect(mocks.resets).toHaveBeenLastCalledWith(expect.objectContaining({ data: { deliveryState: "FAILED", deliveryLeaseUntil: null } })); });
  it.each([0, 11, 1.5])("refuses delivery limit %s before queries", async limit => { await expect(deliverPasswordRecoveries(limit, config, vi.fn())).rejects.toThrow(); expect(mocks.findMany).not.toHaveBeenCalled(); });
});
