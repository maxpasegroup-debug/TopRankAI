import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  tx: {
    $queryRaw: vi.fn(),
    mockPayment: { findUnique: vi.fn(), create: vi.fn() },
    subscription: { findUnique: vi.fn(), upsert: vi.fn() },
    candidateExamTarget: { findFirst: vi.fn(), update: vi.fn() },
    notification: { create: vi.fn(), createMany: vi.fn() },
  },
  transaction: vi.fn(), revalidate: vi.fn(),
}));
vi.mock("@/server/db", () => ({ prisma: { ...mocks.tx, $transaction: mocks.transaction } }));
vi.mock("@/server/auth/session", () => ({ requireAuth: async () => ({ id: "owner" }) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { mockCheckout } from "@/server/actions/subscriptions";
import { renewalEnd, renewalNotice } from "@/shared/subscriptions";
import { mockMonthlyActive, paperCount } from "@/shared/daily-workload";
import { getSubscription } from "@/server/platform/subscriptions";

const input = { id: "f1234567-1234-4234-8234-123456789012", plan: "MOCK_YEARLY", outcome: "SUCCESS", schedule: { targetId: "target", count: 8, startMinutes: 600 } };
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-18T12:00:00Z"));
  mocks.transaction.mockImplementation((fn) => fn(mocks.tx));
  mocks.tx.mockPayment.create.mockImplementation(async ({ data }) => data);
  mocks.tx.candidateExamTarget.findFirst.mockResolvedValue({ id: "target" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it("saves server-priced payment, Pro entitlement and owned schedule in one transaction", async () => {
  expect((await mockCheckout({ ...input, amountPaise: 1 })).ok).toBe(true);
  expect(mocks.tx.mockPayment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: "owner", amountPaise: 299900, endsAt: new Date("2027-11-18T12:00Z") }) });
  expect(mocks.tx.candidateExamTarget.findFirst).toHaveBeenCalledWith({ where: expect.objectContaining({ userId: "owner", active: true }) });
  expect(mocks.tx.candidateExamTarget.update).toHaveBeenCalledWith({ where: { id: "target" }, data: { dailyPaperCount: 8, dailyStartMinutes: 600 } });
  expect(mocks.revalidate).toHaveBeenCalledWith("/app", "layout");
});
it("records declines without altering the subscription or daily schedule", async () => {
  expect((await mockCheckout({ ...input, outcome: "FAILED" })).ok).toBe(false);
  expect(mocks.tx.mockPayment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ status: "FAILED", endsAt: null }) });
  expect(mocks.tx.subscription.upsert).not.toHaveBeenCalled();
  expect(mocks.tx.candidateExamTarget.update).not.toHaveBeenCalled();
});
it("replays an existing successful payment without extending access again", async () => {
  mocks.tx.mockPayment.findUnique.mockResolvedValue({ id: input.id, userId: "owner", status: "SUCCESS" });
  expect((await mockCheckout(input)).ok).toBe(true);
  expect(mocks.tx.$queryRaw).toHaveBeenCalled();
  expect(mocks.tx.mockPayment.create).not.toHaveBeenCalled();
  expect(mocks.tx.subscription.upsert).not.toHaveBeenCalled();
});
it("does not reveal or replay another account's payment", async () => {
  mocks.tx.mockPayment.findUnique.mockResolvedValue({ id: input.id, userId: "someone-else", status: "SUCCESS" });
  expect((await mockCheckout(input)).ok).toBe(false);
  expect(mocks.tx.subscription.upsert).not.toHaveBeenCalled();
});
it("rejects another user's or inactive exam before recording a payment", async () => {
  mocks.tx.candidateExamTarget.findFirst.mockResolvedValue(null);
  expect((await mockCheckout(input)).ok).toBe(false);
  expect(mocks.tx.mockPayment.create).not.toHaveBeenCalled();
});
it("preserves unexpired time when renewing or switching billing periods", async () => {
  mocks.tx.subscription.findUnique.mockResolvedValue({ plan: "MOCK_MONTHLY", status: "ACTIVE", startsAt: new Date("2026-11-01"), endsAt: new Date("2026-12-01T09:00Z") });
  await mockCheckout(input);
  expect(mocks.tx.mockPayment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ endsAt: new Date("2027-12-01T09:00Z") }) });
});
it("rejects forged plans, excess paper counts and invalid start times", async () => {
  for (const invalid of [{ ...input, plan: "FREE" }, { ...input, schedule: { ...input.schedule, count: 9 } }, { ...input, schedule: { ...input.schedule, startMinutes: 1440 } }]) expect((await mockCheckout(invalid)).ok).toBe(false);
  expect(mocks.transaction).not.toHaveBeenCalled();
});
it("does not replace non-mock paid plans", async () => {
  mocks.tx.subscription.findUnique.mockResolvedValue({ plan: "PREMIUM" });
  expect((await mockCheckout(input)).ok).toBe(false);
  expect(mocks.tx.mockPayment.create).not.toHaveBeenCalled();
});
it("clamps calendar renewals at month end and leap years", () => {
  expect(renewalEnd(new Date("2027-01-31T12:00Z"), 1).toISOString()).toBe("2027-02-28T12:00:00.000Z");
  expect(renewalEnd(new Date("2028-02-29T12:00Z"), 12).toISOString()).toBe("2029-02-28T12:00:00.000Z");
});
it("restores the level allowance exactly when yearly access expires", () => {
  const plan = { plan: "MOCK_YEARLY", status: "ACTIVE", endsAt: new Date("2026-11-18T12:00Z") };
  expect(paperCount("BEGINNER", 8, mockMonthlyActive(plan))).toBe(1);
  expect(mockMonthlyActive(plan, new Date("2026-11-18T11:59Z"))).toBe(true);
  expect(mockMonthlyActive({ ...plan, status: "CANCELLED" })).toBe(false);
});
it("reminds only within seven days and once per expiry period via a stable notification ID", async () => {
  expect(renewalNotice(new Date("2026-11-26T12:00Z"))).toBe(null);
  expect(renewalNotice(new Date("2026-11-25T12:00Z"))).toBe("renewal");
  expect(renewalNotice(new Date("2026-11-18T12:00Z"))).toBe("expired");
  mocks.tx.subscription.findUnique.mockResolvedValue({ id: "sub", plan: "MOCK_YEARLY", status: "ACTIVE", endsAt: new Date("2026-11-20T12:00Z") });
  await getSubscription("owner"); await getSubscription("owner");
  const calls = mocks.tx.notification.createMany.mock.calls;
  expect(calls[0][0].skipDuplicates).toBe(true);
  expect(calls[0][0].data[0].id).toBe(calls[1][0].data[0].id);
});
