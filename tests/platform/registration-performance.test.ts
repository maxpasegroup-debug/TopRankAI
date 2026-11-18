import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exams: vi.fn(), existing: vi.fn(), hash: vi.fn(), cookie: vi.fn(), session: vi.fn(),
  transaction: vi.fn(),
  tx: {
    user: { create: vi.fn() },
    accountConsent: { create: vi.fn() },
    studentProfile: { create: vi.fn() },
    candidateExamTarget: { createMany: vi.fn() },
    subscription: { create: vi.fn() },
    auditEvent: { create: vi.fn() },
    notification: { createMany: vi.fn() },
    session: { create: vi.fn() },
  },
}));
vi.mock("@/server/db", () => ({ prisma: {
  exam: { findMany: mocks.exams }, user: { findUnique: mocks.existing }, $transaction: mocks.transaction,
} }));
vi.mock("@/server/auth/password", () => ({ hashPassword: mocks.hash, verifyPassword: vi.fn() }));
vi.mock("@/server/auth/session", () => ({
  createSession: mocks.session, revokeSession: vi.fn(), SESSION_COOKIE: "toprank_session",
  sessionCookieOptions: () => ({ httpOnly: true }),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: mocks.cookie }) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { registerCandidate } from "@/server/actions/auth";

const input = {
  name: "Test candidate", email: "test@example.com", password: "test-password",
  dateOfBirth: "2000-01-01", gender: "PREFER_NOT_TO_SAY", state: "Kerala", city: "Ernakulam",
  education: "Class 12", preferredLanguage: "English", termsAccepted: true, privacyAccepted: true,
  exams: [{ examId: "exam", level: "INTERMEDIATE", targetYear: new Date().getFullYear() + 1, dailyMinutes: 45 }],
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.exams.mockResolvedValue([{ id: "exam", name: "NEET", configuration: null }]);
  mocks.existing.mockResolvedValue(null);
  mocks.hash.mockResolvedValue("hashed-password");
  mocks.tx.user.create.mockResolvedValue({ id: "candidate" });
  mocks.session.mockResolvedValue({ token: "test-token", expiresAt: new Date() });
  mocks.transaction.mockImplementation((fn: (tx: typeof mocks.tx) => unknown) => fn(mocks.tx));
});

describe("registration transaction", () => {
  it("saves the complete account, both notices and the session before setting its cookie", async () => {
    expect(await registerCandidate(input)).toEqual({ ok: true, redirectTo: "/app" });
    expect(mocks.tx.candidateExamTarget.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ userId: "candidate", examId: "exam", preparationLevel: "INTERMEDIATE", dailyMinutes: 45 })],
    });
    expect(mocks.tx.notification.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ type: "TARGET" }), expect.objectContaining({ type: "SYSTEM" })],
    });
    expect(mocks.session).toHaveBeenCalledWith("candidate", mocks.tx);
    expect(mocks.tx.accountConsent.create).toHaveBeenCalledTimes(1);
    expect(mocks.tx.subscription.create).toHaveBeenCalledTimes(1);
    expect(mocks.cookie).toHaveBeenCalledTimes(1);
  });

  it("does not set a session cookie when transactional notifications fail", async () => {
    mocks.tx.notification.createMany.mockRejectedValue(new Error("write failed"));
    expect((await registerCandidate(input)).ok).toBe(false);
    expect(mocks.session).not.toHaveBeenCalled();
    expect(mocks.cookie).not.toHaveBeenCalled();
  });

  it("rejects duplicate accounts before hashing or writing", async () => {
    mocks.existing.mockResolvedValue({ id: "existing" });
    expect(await registerCandidate(input)).toMatchObject({ ok: false, field: "email" });
    expect(mocks.hash).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("revalidates exam availability against the database", async () => {
    mocks.exams.mockResolvedValue([]);
    expect((await registerCandidate(input)).ok).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
