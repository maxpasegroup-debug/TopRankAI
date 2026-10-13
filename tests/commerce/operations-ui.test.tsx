import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/components/journey/client", () => ({ studentRequest: vi.fn() }));
import { LaunchOperations } from "@/components/commerce/LaunchOperations";
import { CommerceWorkspace, AdminCommerce } from "@/components/commerce/CommerceWorkspace";
describe("commerce operations initial SSR (not browser acceptance)", () => {
  it("connects the operations shell to real administration with explicit loading", () => { const html = renderToStaticMarkup(<LaunchOperations />); expect(html).toContain("Launch operations"); expect(html).toContain("Entitlements"); expect(html).toContain("Audit"); expect(html).toContain("Loading operations..."); expect(html).toContain('href="/admin/commerce"'); expect(html).not.toContain("Ready for production"); });
  it("links commerce administration to the operational view with disabled-payment status", () => { const html = renderToStaticMarkup(<AdminCommerce />); expect(html).toContain('href="/admin/operations"'); expect(html).toContain("live payment processing disabled"); });
  it("student offering is packages and access rather than an active checkout", () => { const html = renderToStaticMarkup(<CommerceWorkspace />); expect(html).toContain("Packages &amp; access"); expect(html).not.toContain("checkout.razorpay.com"); });
});
