import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationApiError } from "@/server/api/errors";
const db = vi.hoisted(() => ({ lesson: { findFirst: vi.fn(), findMany: vi.fn() }, questionExam: { findFirst: vi.fn() } }));
const access = vi.hoisted(() => vi.fn());
vi.mock("@/server/db", () => ({ prisma: db })); vi.mock("@/server/commerce/access", () => ({ requireResourceAccess: access }));
import { missionActionAvailable, nextAccessibleLesson, nextAvailablePractice } from "@/server/sia/actions";
const user = { id: "student", name: "Student", email: "private@example.com", role: "STUDENT" as const };
beforeEach(() => { vi.resetAllMocks(); db.lesson.findFirst.mockResolvedValue({ id: "lesson" }); db.lesson.findMany.mockResolvedValue([]); db.questionExam.findFirst.mockResolvedValue({ id: "link" }); });
describe("SIA action availability, mocked persistence", () => {
  it.each([null, "javascript:alert(1)", "https://evil.test", "//evil.test", "/learn/old", "/learn/a/b/c?user=other", "/admin", "/learn/a/b/%2f", "/practice/subjects/a/questions?role=ADMIN"])("rejects unsafe or unsupported path %s", async href => {
    expect(await missionActionAvailable(user, href, "exam")).toBe(false); expect(db.lesson.findFirst).not.toHaveBeenCalled(); expect(db.questionExam.findFirst).not.toHaveBeenCalled();
  });
  it("checks published canonical lesson hierarchy, target exam and ownership access", async () => {
    expect(await missionActionAvailable(user, "/learn/physics/motion/speed", "exam")).toBe(true);
    const where = db.lesson.findFirst.mock.calls[0][0].where; expect(where).toMatchObject({ slug: "speed", status: "PUBLISHED", active: true, chapter: { slug: "motion", subject: { slug: "physics", examSubjects: { some: { examId: "exam", exam: { status: "PUBLISHED", active: true } } } } } }); expect(access).toHaveBeenCalledWith("LESSON", "lesson", user);
  });
  it("rejects retired/missing lessons without an entitlement call", async () => { db.lesson.findFirst.mockResolvedValue(null); expect(await missionActionAvailable(user, "/learn/a/b/c", "exam")).toBe(false); expect(access).not.toHaveBeenCalled(); });
  it("does not recommend gated lessons without access", async () => { access.mockRejectedValue(new AuthorizationApiError()); expect(await missionActionAvailable(user, "/learn/a/b/c", "exam")).toBe(false); });
  it("does not disguise infrastructure failure as missing content", async () => { access.mockRejectedValue(new Error("provider unavailable")); await expect(missionActionAvailable(user, "/learn/a/b/c", "exam")).rejects.toThrow("provider unavailable"); });
  it("checks reviewed, published, scored practice for the target exam", async () => {
    expect(await missionActionAvailable(user, "/practice/subjects/physics/questions", "exam")).toBe(true); expect(db.questionExam.findFirst.mock.calls[0][0].where).toMatchObject({ examId: "exam", scoringMode: { not: null }, question: { reviewStatus: "REVIEWED", status: "PUBLISHED", subject: { slug: "physics" } } });
  });
  it("rejects empty practice", async () => { db.questionExam.findFirst.mockResolvedValue(null); expect(await missionActionAvailable(user, "/practice/subjects/physics/questions", "exam")).toBe(false); });
  it("builds practice fallback from canonical subject metadata", async () => {
    db.questionExam.findFirst.mockResolvedValue({ question: { subject: { name: "Physics", slug: "physics" } } }); expect(await nextAvailablePractice("exam")).toEqual({ title: "Physics", href: "/practice/subjects/physics/questions" });
  });
  it("returns no practice fallback when no eligible questions exist", async () => { db.questionExam.findFirst.mockResolvedValue(null); expect(await nextAvailablePractice("exam")).toBeNull(); });
  it("uses unfinished published lessons and skips inaccessible candidates", async () => {
    db.lesson.findMany.mockResolvedValue([{ id: "locked", title: "Locked", slug: "locked", chapter: { slug: "c", subject: { slug: "s" } } }, { id: "open", title: "Open", slug: "open", chapter: { slug: "c", subject: { slug: "s" } } }]); access.mockRejectedValueOnce(new AuthorizationApiError());
    expect(await nextAccessibleLesson(user, "exam")).toEqual({ title: "Open", href: "/learn/s/c/open" }); expect(db.lesson.findMany.mock.calls[0][0]).toMatchObject({ take: 20, where: { studentProgress: { none: { userId: user.id, completedAt: { not: null } } } } });
  });
});
