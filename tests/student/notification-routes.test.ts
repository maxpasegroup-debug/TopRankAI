import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), inbox: vi.fn(), read: vi.fn() }));
vi.mock("@/server/db", () => ({ prisma: {} }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/server/notifications/service", async importOriginal => ({ ...await importOriginal<typeof import("@/server/notifications/service")>(), getInbox: mocks.inbox, readInbox: mocks.read }));
import { GET, POST } from "@/app/api/student/notifications/route";
const user = { id: "student", name: "Student", email: "private@example.test", role: "STUDENT" };
const request = (body: unknown, origin = "http://localhost") => new Request("http://localhost/api/student/notifications", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); mocks.user.mockResolvedValue(user); mocks.inbox.mockResolvedValue({ entries: [], unread: 0 }); mocks.read.mockResolvedValue({ saved: true }); });
describe("private notification route boundaries", () => {
  it.each([GET, POST])("denies anonymous access before service calls", async handler => { mocks.user.mockResolvedValue(null); const response = await handler(handler === GET ? new Request("http://localhost/api/student/notifications") : request({ action: "READ_ALL" })); expect(response.status).toBe(401); expect(mocks.inbox).not.toHaveBeenCalled(); expect(mocks.read).not.toHaveBeenCalled(); });
  it.each(["PARENT", "TEACHER", "SCHOOL_ADMIN", "PLATFORM_ADMIN"])("denies %s student inbox access", async role => { mocks.user.mockResolvedValue({ ...user, role }); expect((await GET(new Request("http://localhost/api/student/notifications"))).status).toBe(403); expect((await POST(request({ action: "READ_ALL" }))).status).toBe(403); expect(mocks.inbox).not.toHaveBeenCalled(); expect(mocks.read).not.toHaveBeenCalled(); });
  it("passes only authenticated identity and whitelisted query fields", async () => { const result = await GET(new Request("http://localhost/api/student/notifications?userId=foreign&role=PLATFORM_ADMIN&page=2&unread=true")); expect(result.status).toBe(200); expect(result.headers.get("Cache-Control")).toBe("no-store"); expect(mocks.inbox).toHaveBeenCalledWith(user, { page: "2", unread: "true" }); });
  it("rejects cross-origin mutations before any service call", async () => { expect((await POST(request({ action: "READ_ALL" }, "https://attacker.example"))).status).toBe(403); expect(mocks.read).not.toHaveBeenCalled(); });
  it("rejects forged ownership in a mutation", async () => { expect((await POST(request({ action: "READ", id: "n", userId: "foreign" }))).status).toBe(400); expect(mocks.read).not.toHaveBeenCalled(); });
  it("uses the authenticated owner for a valid read mutation", async () => { expect((await POST(request({ action: "READ", id: "n" }))).status).toBe(200); expect(mocks.read).toHaveBeenCalledWith(user, { action: "READ", id: "n" }); });
  it("sanitizes service errors", async () => { mocks.inbox.mockRejectedValue(new Error("secret internal database details")); const result = await GET(new Request("http://localhost/api/student/notifications")); expect(result.status).toBe(500); expect(JSON.stringify(await result.json())).not.toMatch(/secret|database|stack/); });
});
