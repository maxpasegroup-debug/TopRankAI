import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/server/auth/session";
vi.mock("@/server/db", () => ({ prisma: {} }));
const mocks = vi.hoisted(() => ({ journey: vi.fn(), board: vi.fn(), revision: vi.fn(), competition: vi.fn(), available: vi.fn(), lesson: vi.fn(), practice: vi.fn(), practiceAction: vi.fn() }));
vi.mock("@/server/sia/actions", () => ({ missionActionAvailable: mocks.available, nextAccessibleLesson: mocks.lesson, nextAvailablePractice: mocks.practiceAction }));
vi.mock("@/server/practice/revision", () => ({ getPracticeRevision: mocks.practice }));
vi.mock("@/server/competition/service", () => ({ getCompetitionSuggestion: mocks.competition }));
vi.mock("@/server/mock/service", () => ({ getMockRevision: mocks.revision }));
vi.mock("@/server/journey/service", () => ({ getJourney: mocks.journey, getMissionBoard: mocks.board }));
import { getSiaGuidance } from "@/server/sia/service";
const user: AuthUser = { id: "student", role: "STUDENT", name: "S", email: "s@example.com" };
beforeEach(() => { vi.resetAllMocks(); mocks.available.mockResolvedValue(true); mocks.lesson.mockResolvedValue(null); mocks.practiceAction.mockResolvedValue(null); mocks.practice.mockResolvedValue({ entries: [] }); mocks.competition.mockResolvedValue(null); mocks.revision.mockResolvedValue([]); mocks.journey.mockResolvedValue({ profile: { dreamCollege: "My career goal", targetExamId: "exam" } }); });
describe("SIA deterministic guidance", () => {
  it("grounds suggestions in saved unfinished missions without sending personal data externally", async () => {
    mocks.board.mockResolvedValue({ examId: "exam", tasks: [{ status: "COMPLETED", title: "Old", minutes: 60 }, { id: "task", dueDate: new Date("2000-01-01"), status: "TODO", title: "Cells", minutes: 45, href: "/learn/biology/cells/introduction" }] });
    const result = await getSiaGuidance(user); expect(result).toMatchObject({ source: "deterministic", externalProviderConnected: false, href: "/learn/biology/cells/introduction" });
    expect(result.suggestion).toContain("Cells"); expect(result.suggestion).toContain("45"); expect(JSON.stringify(result)).not.toContain(user.email);
    expect(mocks.journey).toHaveBeenCalledWith(user); expect(mocks.board).toHaveBeenCalledWith(user);
  });
  it("recommends onboarding when no plan exists", async () => { mocks.board.mockResolvedValue(null); expect(await getSiaGuidance(user)).toMatchObject({ href: "/onboarding", externalProviderConnected: false }); });
  it("does not fabricate a mission after all tasks are complete", async () => { mocks.board.mockResolvedValue({ tasks: [{ status: "COMPLETED", title: "Cells", minutes: 45 }] }); expect(await getSiaGuidance(user)).toMatchObject({ href: "/home" }); });
  it("uses saved mock revision when missions are finished", async () => {
    mocks.board.mockResolvedValue({ tasks: [] }); mocks.revision.mockResolvedValue([{ reviewedAt: null, subject: "Physics", reasons: ["Incorrect"] }]);
    expect(await getSiaGuidance(user)).toMatchObject({ href: "/practice/revision", suggestion: expect.stringContaining("Physics") });
  });
  it("links to an observed challenge without claiming eligibility", async () => { mocks.board.mockResolvedValue({ tasks: [] }); mocks.competition.mockResolvedValue({ suggestion: "A published challenge is open", href: "/compete?id=c" }); expect(await getSiaGuidance(user)).toMatchObject({ href: "/compete?id=c" }); });
  it("skips unavailable due content", async () => {
    mocks.board.mockResolvedValue({ examId: "exam", tasks: [{ status: "TODO", dueDate: new Date("2000-01-01"), href: "/learn/old", title: "Old" }] }); mocks.available.mockResolvedValue(false);
    expect(await getSiaGuidance(user)).toMatchObject({ href: "/home", skippedUnavailable: 1 });
  });
  it("does not recommend future missions prematurely", async () => {
    mocks.board.mockResolvedValue({ examId: "exam", tasks: [{ status: "TODO", dueDate: new Date("2099-01-01"), href: "/learn/future" }] });
    expect(await getSiaGuidance(user)).toMatchObject({ reason: "FUTURE_PLAN", href: "/home" }); expect(mocks.available).not.toHaveBeenCalled();
  });
  it("uses available practice revision before mock revision", async () => {
    mocks.board.mockResolvedValue({ tasks: [] }); mocks.practice.mockResolvedValue({ entries: [{ available: true, incorrect: true, reviewed: false }] });
    expect(await getSiaGuidance(user)).toMatchObject({ reason: "PRACTICE_REVISION" }); expect(mocks.revision).not.toHaveBeenCalled();
  });
  it.each([{ available: false, incorrect: true, reviewed: false }, { available: true, incorrect: true, reviewed: true }, { available: true, incorrect: false, reviewed: false }])("ignores ineligible revision %j", async entry => {
    mocks.board.mockResolvedValue({ tasks: [] }); mocks.practice.mockResolvedValue({ entries: [entry] }); expect(await getSiaGuidance(user)).toMatchObject({ reason: "NO_AVAILABLE_ACTION" });
  });
  it("recommends an accessible unfinished lesson without live AI", async () => {
    mocks.board.mockResolvedValue({ tasks: [] }); mocks.lesson.mockResolvedValue({ title: "Cells", href: "/learn/biology/cells/introduction" });
    expect(await getSiaGuidance(user)).toMatchObject({ reason: "LESSON", externalProviderConnected: false, aiStatus: "DISABLED_PENDING_APPROVAL" });
  });
  it("ignores missions for the previous target exam", async () => {
    mocks.board.mockResolvedValue({ examId: "old-exam", tasks: [{ status: "TODO", dueDate: new Date("2000-01-01"), href: "/learn/old" }] });
    await getSiaGuidance(user); expect(mocks.available).not.toHaveBeenCalled();
  });
  it("offers reviewed practice when no unfinished lesson is available", async () => {
    mocks.board.mockResolvedValue({ tasks: [] }); mocks.practiceAction.mockResolvedValue({ title: "Physics", href: "/practice/subjects/physics/questions" });
    expect(await getSiaGuidance(user)).toMatchObject({ reason: "PRACTICE", href: "/practice/subjects/physics/questions" });
  });
  it("bounds availability checks", async () => {
    mocks.board.mockResolvedValue({ examId: "exam", tasks: Array.from({ length: 50 }, () => ({ status: "TODO", dueDate: new Date("2000-01-01"), href: "/learn/old" })) }); mocks.available.mockResolvedValue(false);
    expect(await getSiaGuidance(user)).toMatchObject({ skippedUnavailable: 20 }); expect(mocks.available).toHaveBeenCalledTimes(20);
  });
  it("rejects invalid timezones before any read", async () => { await expect(getSiaGuidance(user, "not/a-zone")).rejects.toThrow(); expect(mocks.journey).not.toHaveBeenCalled(); });
  it.each(["PARENT", "TEACHER", "SCHOOL_ADMIN", "PLATFORM_ADMIN"] as const)("rejects %s before reads", async role => { await expect(getSiaGuidance({ ...user, role })).rejects.toThrow(); expect(mocks.journey).not.toHaveBeenCalled(); });
});
