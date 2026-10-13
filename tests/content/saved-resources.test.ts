import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationApiError } from "@/server/api/errors";
const db = vi.hoisted(() => ({ learningResource: { findFirst: vi.fn() }, studentSavedResource: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() }, access: vi.fn() }));
vi.mock("@/server/db", () => ({ prisma: db }));
vi.mock("@/server/commerce/access", () => ({ requireResourceAccess: db.access }));
import { getSavedResourceState, listSavedResources, saveResource, saveResourceSchema } from "@/server/content/saved-resources";
const student = { id: "s1", role: "STUDENT" as const, name: "Student", email: "s@example.com" };
const row = { resourceId: "r1", resource: { title: "Notes", type: "NOTES", reference: "Original inline notes", url: "https://example.com/notes", lessonId: "l1", lesson: { slug: "lesson", chapter: { slug: "chapter", subject: { slug: "physics" } } } } };
beforeEach(() => { vi.resetAllMocks(); db.learningResource.findFirst.mockResolvedValue({ id: "r1", lessonId: "l1" }); db.studentSavedResource.findMany.mockResolvedValue([row]); });
describe("student saved resources (mocked database)", () => {
  it.each(["PARENT", "TEACHER", "SCHOOL_ADMIN", "PLATFORM_ADMIN"] as const)("denies %s before persistence", async role => {
    await expect(saveResource({ ...student, role }, { resourceId: "r1", saved: true })).rejects.toBeInstanceOf(AuthorizationApiError);
    await expect(listSavedResources({ ...student, role })).rejects.toBeInstanceOf(AuthorizationApiError); expect(db.learningResource.findFirst).not.toHaveBeenCalled();
  });
  it("rejects injected ownership and unsafe save values", () => { expect(saveResourceSchema.safeParse({ resourceId: "r1", saved: true, userId: "other" }).success).toBe(false); expect(saveResourceSchema.safeParse({ resourceId: "r1", saved: "true" }).success).toBe(false); });
  it("saves idempotently for the session student and checks published ancestry/entitlement", async () => {
    await saveResource(student, { resourceId: "r1", saved: true }); expect(db.learningResource.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "r1", status: "PUBLISHED", active: true, lesson: { status: "PUBLISHED", active: true, chapter: { status: "PUBLISHED", active: true, subject: { status: "PUBLISHED", active: true } } } } }));
    expect(db.access).toHaveBeenCalledWith("LESSON", "l1", student);
    expect(db.studentSavedResource.upsert).toHaveBeenCalledWith({ where: { userId_resourceId: { userId: "s1", resourceId: "r1" } }, create: { userId: "s1", resourceId: "r1" }, update: {} });
  });
  it("rejects unpublished/missing resources without a bookmark write", async () => { db.learningResource.findFirst.mockResolvedValue(null); await expect(saveResource(student, { resourceId: "r1", saved: true })).rejects.toThrow(); expect(db.studentSavedResource.upsert).not.toHaveBeenCalled(); });
  it("rejects paid resources without entitlement before a bookmark write", async () => { db.access.mockRejectedValue(new AuthorizationApiError()); await expect(saveResource(student, { resourceId: "r1", saved: true })).rejects.toThrow(); expect(db.studentSavedResource.upsert).not.toHaveBeenCalled(); });
  it("allows removing an archived bookmark, scoped to its owner", async () => {
    await saveResource(student, { resourceId: "r1", saved: false }); expect(db.studentSavedResource.deleteMany).toHaveBeenCalledWith({ where: { userId: "s1", resourceId: "r1" } }); expect(db.learningResource.findFirst).not.toHaveBeenCalled();
  });
  it("reads only the student's saved state without exposing resource content", async () => { db.studentSavedResource.findUnique.mockResolvedValue({ resourceId: "r1" }); await expect(getSavedResourceState(student, "r1")).resolves.toEqual({ saved: true }); expect(db.studentSavedResource.findUnique).toHaveBeenCalledWith({ where: { userId_resourceId: { userId: "s1", resourceId: "r1" } }, select: { resourceId: true } }); });
  it("bounds/paginates reads, filters ancestry and returns safe links", async () => {
    const result = await listSavedResources(student, "r0"); expect(result.records[0]).toMatchObject({ href: "/learn/physics/chapter/lesson", url: "https://example.com/notes" }); expect(db.studentSavedResource.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: "s1", resourceId: { gt: "r0" } }), take: 51 }));
  });
  it("does not expose old paid bookmarks after entitlement loss", async () => { db.access.mockRejectedValue(new AuthorizationApiError()); expect((await listSavedResources(student)).records).toEqual([]); });
  it("sanitizes an unsafe legacy resource URL", async () => { db.studentSavedResource.findMany.mockResolvedValue([{ ...row, resource: { ...row.resource, url: "javascript:alert(1)" } }]); expect((await listSavedResources(student)).records[0].url).toBeNull(); });
  it("keeps a next cursor even when current entitlements filter an entire page", async () => {
    db.studentSavedResource.findMany.mockResolvedValue(Array.from({ length: 51 }, (_, index) => ({ ...row, resourceId: "r" + index }))); db.access.mockRejectedValue(new AuthorizationApiError());
    await expect(listSavedResources(student)).resolves.toMatchObject({ records: [], nextCursor: "r49" });
  });
});
