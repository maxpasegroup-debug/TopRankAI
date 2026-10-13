import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/server/auth/session";
const db = vi.hoisted(() => ({ commerceNotification: { findMany: vi.fn(), count: vi.fn(), updateMany: vi.fn(), upsert: vi.fn() } }));
vi.mock("@/server/db", () => ({ prisma: db }));
import { getInbox, readInbox, inAppNotice, inboxMutationSchema, inboxQuerySchema } from "@/server/notifications/service";
const student: AuthUser = { id: "student", role: "STUDENT", name: "Private name", email: "private@example.test" };
const at = new Date("2026-10-11T12:00:00Z");
beforeEach(() => { vi.resetAllMocks(); db.commerceNotification.findMany.mockResolvedValue([]); db.commerceNotification.count.mockResolvedValue(0); db.commerceNotification.updateMany.mockResolvedValue({ count: 0 }); });
describe("owner-only in-app notifications (mocked persistence)", () => {
  it.each(["PARENT", "TEACHER", "SCHOOL_ADMIN", "PLATFORM_ADMIN"] as const)("denies %s access before persistence", async role => {
    await expect(getInbox({ ...student, role }, {})).rejects.toThrow(); await expect(readInbox({ ...student, role }, { action: "READ_ALL" })).rejects.toThrow(); expect(db.commerceNotification.findMany).not.toHaveBeenCalled(); expect(db.commerceNotification.updateMany).not.toHaveBeenCalled();
  });
  it("scopes reads to available in-app records and projects no internal metadata", async () => {
    db.commerceNotification.findMany.mockResolvedValue([{ id: "notice", template: "SUPPORT_UPDATED", message: "Your support request has an update.", readAt: null, createdAt: at, eventKey: "private-help-id", providerResponse: "secret", userId: student.id }]);
    expect(await getInbox(student, { userId: "other", role: "PLATFORM_ADMIN" })).toEqual({ page: 1, unread: 0, hasNext: false, entries: [{ id: "notice", message: "Your support request has an update.", read: false, at: at.toISOString(), href: "/get-help" }] });
    expect(db.commerceNotification.findMany.mock.calls[0][0].where).toEqual({ userId: student.id, channel: "IN_APP", status: "AVAILABLE" });
    expect(db.commerceNotification.count.mock.calls[0][0].where).toMatchObject({ userId: student.id, channel: "IN_APP", status: "AVAILABLE", readAt: null });
  });
  it("uses a stable paginated sentinel and an unread filter", async () => {
    db.commerceNotification.findMany.mockResolvedValue(Array.from({ length: 26 }, (_, i) => ({ id: String(i), template: "ACHIEVEMENT_EARNED", message: "Earned", createdAt: at, readAt: at })));
    const result = await getInbox(student, { page: "2", unread: "true" }); expect(result.entries).toHaveLength(25); expect(result.hasNext).toBe(true);
    expect(db.commerceNotification.findMany.mock.calls[0][0]).toMatchObject({ skip: 25, take: 26, orderBy: [{ createdAt: "desc" }, { id: "desc" }], where: { readAt: null } });
  });
  it.each([0, -1, 101, 1.5, "bad"])("rejects invalid page %s without querying", async page => { await expect(getInbox(student, { page })).rejects.toThrow(); expect(db.commerceNotification.findMany).not.toHaveBeenCalled(); });
  it.each(["SUPPORT_UPDATED", "ACHIEVEMENT_EARNED", "COMPETITION_VERIFIED", "COMPETITION_CANCELLED", "PORTAL_UPDATED", "UNKNOWN"])("uses a fixed internal destination for %s", async template => {
    db.commerceNotification.findMany.mockResolvedValue([{ id: "n", template, message: "Notice", createdAt: at, readAt: null }]); const result = await getInbox(student, {}); expect(result.entries[0].href).toMatch(/^\/(get-help|achievements|compete|consent|packages)$/);
  });
  it("marks only an unread owned record and does not disclose foreign existence", async () => {
    expect(await readInbox(student, { action: "READ", id: "foreign" })).toEqual({ saved: true });
    expect(db.commerceNotification.updateMany.mock.calls[0][0].where).toEqual({ userId: student.id, id: "foreign", channel: "IN_APP", status: "AVAILABLE", readAt: null });
  });
  it("repeat reads never overwrite the first read timestamp", async () => { await readInbox(student, { action: "READ", id: "n" }); await readInbox(student, { action: "READ", id: "n" }); for (const [args] of db.commerceNotification.updateMany.mock.calls) expect(args.where.readAt).toBeNull(); });
  it("bounds mark-all to records existing at the server timestamp", async () => { await readInbox(student, { action: "READ_ALL" }); const args = db.commerceNotification.updateMany.mock.calls[0][0]; expect(args.where.createdAt.lte).toEqual(args.data.readAt); expect(args.where.userId).toBe(student.id); });
  it.each([{ action: "READ", id: "n", userId: "other" }, { action: "READ_ALL", role: "PLATFORM_ADMIN" }, { action: "READ_ALL", channel: "EMAIL" }, { action: "DELETE", id: "n" }, { action: "READ", id: "" }])("rejects forged mutation %j", input => { expect(inboxMutationSchema.safeParse(input).success).toBe(false); });
  it("rejects a forged unread mode", () => { expect(inboxQuerySchema.safeParse({ unread: "all" }).success).toBe(false); });
  it.each(["SUPPORT_UPDATED", "ACHIEVEMENT_EARNED", "COMPETITION_VERIFIED", "COMPETITION_CANCELLED"] as const)("deduplicates generic %s notices without external delivery", async template => {
    await inAppNotice(db as never, student.id, "event:1", template); const args = db.commerceNotification.upsert.mock.calls[0][0];
    expect(args.where).toEqual({ userId_eventKey_channel: { userId: student.id, eventKey: "event:1", channel: "IN_APP" } }); expect(args.update).toEqual({}); expect(args.create).toMatchObject({ userId: student.id, channel: "IN_APP", status: "AVAILABLE", template }); expect(args.create.message).not.toMatch(/private|student|event:1|secret/i);
  });
});
