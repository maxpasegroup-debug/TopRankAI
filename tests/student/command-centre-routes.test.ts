import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), read: vi.fn(), add: vi.fn(), choices: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/server/db", () => ({ prisma: {} }));
vi.mock("@/server/journey/command-centre", () => ({ getCommandCentre: mocks.read, addPlannedTask: mocks.add, getStudyChoices: mocks.choices }));
vi.mock("@/server/logger", () => ({ logger: { error: vi.fn() } }));
import { GET, POST } from "@/app/api/student/command-centre/route";
import { GET as CHOICES } from "@/app/api/student/command-centre/choices/route";
const user = { id: "student", role: "STUDENT", name: "S", email: "s@example.test" };
const input = { requestKey: "8664dc14-a97f-4e63-9747-0a76e597a077", kind: "LESSON", resourceId: "lesson", dueDate: "2026-10-11", minutes: 25, timezone: "Asia/Kolkata" };
function req(body = {}, origin = "https://toprank.test") { return new Request("https://toprank.test/api/student/command-centre", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) }); }
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("APP_URL", "https://toprank.test"); mocks.user.mockResolvedValue(user); mocks.read.mockResolvedValue({ days: [] }); });
afterEach(() => vi.unstubAllEnvs());
describe("Command centre routes (mocked services)", () => {
  it.each([GET, POST, CHOICES])("rejects anonymous requests", async handler => { mocks.user.mockResolvedValue(null); expect((await handler(req())).status).toBe(401); expect(mocks.read).not.toHaveBeenCalled(); expect(mocks.add).not.toHaveBeenCalled(); });
  it.each(["PARENT", "TEACHER", "SCHOOL_ADMIN", "PLATFORM_ADMIN"])("rejects %s cross-role access", async role => { mocks.user.mockResolvedValue({ ...user, role }); for (const handler of [GET, POST, CHOICES]) expect((await handler(req(input))).status).toBe(403); });
  it("uses current session identity, private responses and validated calendar context", async () => { const response = await GET(new Request("https://toprank.test/api/student/command-centre?timezone=Asia%2FDubai&start=2026-10-11")); expect(response.headers.get("cache-control")).toBe("no-store"); expect(mocks.read).toHaveBeenCalledWith(user, "Asia/Dubai", "2026-10-11"); expect((await GET(new Request("https://toprank.test/api/student/command-centre?timezone=invalid"))).status).toBe(400); });
  it("rejects invalid dates and calendar requests", async () => { expect((await GET(new Request("https://toprank.test/api/student/command-centre?start=2026-02-30"))).status).toBe(400); expect(mocks.read).not.toHaveBeenCalled(); });
  it("rejects forged ownership, status, href and foreign origins", async () => { expect((await POST(req(input, "https://evil.test"))).status).toBe(403); for (const property of ["userId", "planId", "status", "href"]) expect((await POST(req({ ...input, [property]: "forged" }))).status).toBe(400); expect(mocks.add).not.toHaveBeenCalled(); });
  it("passes validated dates/minutes and sanitizes internal failures", async () => { mocks.add.mockResolvedValue({ id: "task" }); expect((await POST(req(input))).status).toBe(200); expect(mocks.add).toHaveBeenCalledWith(user, expect.objectContaining({ dueDate: new Date("2026-10-11"), minutes: 25 })); mocks.add.mockRejectedValue(new Error("private database details")); const response = await POST(req(input)); expect(response.status).toBe(500); expect(await response.text()).not.toMatch(/private|database|stack/); });
});
