import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ user: vi.fn(), overview: vi.fn(), access: vi.fn(), audit: vi.fn() }));
vi.mock("@/server/db", () => ({ prisma: {} }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: m.user }));
vi.mock("@/server/operations/launch", () => ({ launchOverview: m.overview, listEntitlements: m.access, listOperationalAudit: m.audit }));
import { GET } from "@/app/api/admin/operations/route";
const admin = { id: "admin", role: "PLATFORM_ADMIN", name: "Admin", email: "private@example.test" };
beforeEach(() => { vi.resetAllMocks(); m.user.mockResolvedValue(admin); m.overview.mockResolvedValue({ counts: {} }); m.access.mockResolvedValue({ entries: [] }); m.audit.mockResolvedValue({ entries: [] }); });
describe("admin operational route boundaries", () => {
  it("denies anonymous reads without operational queries", async () => { m.user.mockResolvedValue(null); expect((await GET(new Request("http://localhost/api/admin/operations"))).status).toBe(401); expect(m.overview).not.toHaveBeenCalled(); });
  it.each(["STUDENT", "PARENT", "TEACHER", "SCHOOL_ADMIN"])("denies %s even with forged admin query", async role => { m.user.mockResolvedValue({ ...admin, role }); expect((await GET(new Request("http://localhost/api/admin/operations?role=PLATFORM_ADMIN"))).status).toBe(403); expect(m.overview).not.toHaveBeenCalled(); });
  it("returns no-store overview for the authenticated administrator", async () => { const result = await GET(new Request("http://localhost/api/admin/operations?role=STUDENT")); expect(result.status).toBe(200); expect(result.headers.get("Cache-Control")).toBe("no-store"); expect(m.overview).toHaveBeenCalledWith(admin); });
  it("passes whitelisted access filters without client claims", async () => { await GET(new Request("http://localhost/api/admin/operations?mode=access&page=2&userId=student&status=CURRENT&role=ADMIN")); expect(m.access).toHaveBeenCalledWith(admin, { page: "2", userId: "student", status: "CURRENT" }); });
  it("passes audit filters without sensitive detail options", async () => { await GET(new Request("http://localhost/api/admin/operations?mode=audit&entity=COMMERCE&action=ACCESS_REVOKED&includeSecrets=true")); expect(m.audit).toHaveBeenCalledWith(admin, { page: 1, entity: "COMMERCE", action: "ACCESS_REVOKED" }); });
  it("rejects unknown mode before any service query", async () => { expect((await GET(new Request("http://localhost/api/admin/operations?mode=delete"))).status).toBe(400); expect(m.overview).not.toHaveBeenCalled(); expect(m.audit).not.toHaveBeenCalled(); });
  it("sanitizes internal failures", async () => { m.overview.mockRejectedValue(new Error("secret internal database error")); const result = await GET(new Request("http://localhost/api/admin/operations")); expect(result.status).toBe(500); expect(JSON.stringify(await result.json())).not.toMatch(/secret|database|stack/); });
});
