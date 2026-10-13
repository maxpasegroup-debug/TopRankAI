import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), evidence: vi.fn(), guidance: vi.fn() }));
vi.mock("@/server/db", () => ({ prisma: {} }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/server/journey/progress", () => ({ getStudentEvidence: mocks.evidence }));
vi.mock("@/server/sia/service", () => ({ getSiaGuidance: mocks.guidance }));
import { GET as progress } from "@/app/api/student/progress/route";
import { GET as guidance } from "@/app/api/student/sia/route";
const user = { id: "student", name: "Student", email: "private@example.com", role: "STUDENT" };
beforeEach(() => { vi.resetAllMocks(); mocks.user.mockResolvedValue(user); mocks.evidence.mockResolvedValue({ completedTasks: 1 }); mocks.guidance.mockResolvedValue({ source: "deterministic", externalProviderConnected: false }); });
describe("private progress and SIA reads", () => {
  it.each([progress, guidance])("denies anonymous reads without evidence access", async handler => { mocks.user.mockResolvedValue(null); expect((await handler(new Request("http://localhost/api"))).status).toBe(401); expect(mocks.evidence).not.toHaveBeenCalled(); expect(mocks.guidance).not.toHaveBeenCalled(); });
  it.each(["PARENT", "TEACHER", "SCHOOL_ADMIN", "PLATFORM_ADMIN"])("denies %s reads", async role => { mocks.user.mockResolvedValue({ ...user, role }); expect((await progress(new Request("http://localhost/api"))).status).toBe(403); expect((await guidance(new Request("http://localhost/api"))).status).toBe(403); expect(mocks.evidence).not.toHaveBeenCalled(); expect(mocks.guidance).not.toHaveBeenCalled(); });
  it("ignores forged ownership/role and uses only authenticated identity", async () => {
    const response = await progress(new Request("http://localhost/api?userId=other&role=PLATFORM_ADMIN&timezone=Asia%2FDubai"));
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("no-store"); expect(mocks.evidence).toHaveBeenCalledWith(user, "Asia/Dubai");
  });
  it("passes timezone but never client identity to guidance", async () => { await guidance(new Request("http://localhost/api?userId=other&timezone=UTC")); expect(mocks.guidance).toHaveBeenCalledWith(user, "UTC"); });
  it.each([progress, guidance])("defaults to India calendar", async handler => { await handler(new Request("http://localhost/api")); const mock = handler === progress ? mocks.evidence : mocks.guidance; expect(mock).toHaveBeenCalledWith(user, "Asia/Kolkata"); });
  it("sanitizes internal failures", async () => { mocks.evidence.mockRejectedValue(new Error("secret database internals")); const response = await progress(new Request("http://localhost/api")); expect(response.status).toBe(500); const body = JSON.stringify(await response.json()); expect(body).not.toMatch(/secret|stack|database internals/); });
});
