import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/components/journey/client", () => ({ studentRequest: vi.fn() }));
import { MissionBoard } from "@/components/journey/MissionBoard";
describe("Mission board initial rendering (not browser acceptance)", () => {
  it("renders genuine navigation, timezone/week controls and session recorder", () => { const html = renderToStaticMarkup(<MissionBoard name="Student" />); expect(html).toContain("Asia/Kolkata"); expect(html).toContain("Asia/Dubai"); expect(html).toContain("Week starting"); expect(html).toContain("Start session"); expect(html).toContain('href="/practice/revision"'); expect(html).toContain('href="/progress"'); expect(html).not.toMatch(/99%|guaranteed rank|mastered/); });
  it("escapes student names", () => { expect(renderToStaticMarkup(<MissionBoard name={'<script>bad()</script>'} />)).not.toContain("<script>"); });
});
