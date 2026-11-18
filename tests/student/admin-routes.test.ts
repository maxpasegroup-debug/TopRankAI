vi.mock("@/server/platform/public-cache", () => ({ invalidatePublicContent: vi.fn() }));
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), update: vi.fn(), list: vi.fn(), logger: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/server/db", () => ({ prisma: {} }));
vi.mock("@/server/logger", () => ({ logger: { error: mocks.logger } }));
vi.mock("@/server/operations/service", async (original) => ({ ...await original<object>(), changePublication: mocks.update, listPublicationRecords: mocks.list }));
import { GET, PATCH } from "@/app/api/admin/publication/route";
const admin = { id: "admin", role: "PLATFORM_ADMIN", name: "A", email: "a@example.com" };
function request(origin = "https://toprank.test") { return new Request("https://toprank.test/api/admin/publication", { method: "PATCH", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ entity: "EXAM", id: "exam", status: "PUBLISHED", active: true }) }); }
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("APP_URL", "https://toprank.test"); mocks.user.mockResolvedValue(admin); });
afterEach(() => vi.unstubAllEnvs());
describe("admin HTTP boundary (mocked services)", () => {
  it("requires a session", async () => { mocks.user.mockResolvedValue(null); expect((await PATCH(request())).status).toBe(401); expect(mocks.update).not.toHaveBeenCalled(); });
  it.each(["STUDENT", "PARENT", "PARENT", "PARENT"])("rejects %s even with a forged role query", async (role) => {
    mocks.user.mockResolvedValue({ ...admin, role }); expect((await PATCH(request())).status).toBe(403);
    expect((await GET(new Request("https://toprank.test/api/admin/publication?entity=QUESTION&role=PLATFORM_ADMIN"))).status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.list).not.toHaveBeenCalled();
  });
  it("rejects cross-origin admin changes", async () => { expect((await PATCH(request("https://evil.test"))).status).toBe(403); expect(mocks.update).not.toHaveBeenCalled(); });
  it("publishes using only authenticated authority", async () => { mocks.update.mockResolvedValue({ id: "exam" }); expect((await PATCH(request())).status).toBe(200); expect(mocks.update).toHaveBeenCalledWith(admin, { entity: "EXAM", id: "exam", status: "PUBLISHED", active: true }); });
  it("does not disclose or log raw driver errors", async () => {
    mocks.update.mockRejectedValue(new Error("secret connection string")); const response = await PATCH(request()); expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("secret"); expect(JSON.stringify(mocks.logger.mock.calls)).not.toContain("secret");
  });
});
