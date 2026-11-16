import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/components/journey/client", () => ({ studentRequest: vi.fn() }));
import { GetHelp } from "@/components/journey/GetHelp";
describe("engagement initial SSR states (not browser acceptance)", () => {
  it("shows candidate support and guidance without legacy teacher services", () => { const html = renderToStaticMarkup(<GetHelp />); expect(html).toContain("Send request"); expect(html).toContain("Refresh requests"); expect(html).not.toContain("Notifications"); expect(html).not.toContain("Teacher discovery"); expect(html).not.toContain("private@example"); });
});
