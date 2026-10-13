import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/components/journey/client", () => ({ studentRequest: vi.fn() }));
import { NotificationInbox } from "@/components/journey/NotificationInbox";
import { GetHelp } from "@/components/journey/GetHelp";
describe("engagement initial SSR states (not browser acceptance)", () => {
  it("provides explicit inbox filters, loading and bounded navigation", () => { const html = renderToStaticMarkup(<NotificationInbox />); expect(html).toContain("Loading notifications"); expect(html).toContain("Unread only"); expect(html).toContain("Mark all read"); expect(html).toContain('aria-label="Notification pages"'); expect(html).not.toContain("email sent"); });
  it("connects support and the inbox without claiming unavailable teacher bookings", () => { const html = renderToStaticMarkup(<GetHelp />); expect(html).toContain("Send request"); expect(html).toContain("Refresh requests"); expect(html).toContain("Notifications"); expect(html).toContain("currently unavailable"); expect(html).not.toContain("private@example"); });
});
