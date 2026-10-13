import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ require: vi.fn(), redirect: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ requireAuth: auth.require }));
vi.mock("next/navigation", () => ({ redirect: auth.redirect }));
import Page from "@/app/workspace/page";

beforeEach(() => {
  vi.resetAllMocks();
  auth.redirect.mockImplementation((path: string) => { throw new Error(`redirect:${path}`); });
});

describe("session-derived workspace navigation (not authorization)", () => {
  it.each([
    ["STUDENT", "/home"], ["PARENT", "/parent"], ["TEACHER", "/teacher"],
    ["SCHOOL_ADMIN", "/school"], ["PLATFORM_ADMIN", "/admin/portals"],
  ])("routes current %s session to %s", async (role, path) => {
    auth.require.mockResolvedValue({ id: "viewer", role });
    await expect(Page()).rejects.toThrow(`redirect:${path}`);
    expect(auth.require).toHaveBeenCalledOnce(); expect(auth.redirect).toHaveBeenCalledExactlyOnceWith(path);
  });
  it("never provides a privileged default for an unknown role", async () => {
    auth.require.mockResolvedValue({ id: "viewer", role: "INVENTED" });
    await expect(Page()).rejects.toThrow("redirect:/unauthorized");
  });
  it("cannot route without a valid server session", async () => {
    auth.require.mockRejectedValue(new Error("redirect:/login"));
    await expect(Page()).rejects.toThrow("redirect:/login");
    expect(auth.redirect).not.toHaveBeenCalled();
  });
});
