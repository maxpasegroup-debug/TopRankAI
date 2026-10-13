import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/components/journey/client", () => ({ studentRequest: vi.fn() }));
import { StudioWorkspace } from "@/components/learning/StudioWorkspace";
describe("Studio server-rendered initial shell (not browser acceptance)", () => {
  it("names all eight workspaces and accessible tab/panel relationships", () => { const html = renderToStaticMarkup(<StudioWorkspace />); expect(html).toContain("Content &amp; Knowledge Studio"); expect((html.match(/role="tab"/g) ?? []).length).toBe(8); expect(html).toContain('role="tabpanel"'); expect(html).toContain('aria-controls="studio-panel"'); expect(html).not.toMatch(/numericalAnswer|isCorrect|educator-reviewed library ready/); });
});
