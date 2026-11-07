import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PrivacyRequests } from "@/components/account/PrivacyRequests";
import { AccountConsent } from "@/components/account/AccountConsent";
import Privacy from "@/app/privacy/page";
import Terms from "@/app/terms/page";
import { ACCOUNT_OPERATING_ENTITY, ACCOUNT_POLICY_VERSION } from "@/shared/account-policy";

describe("account privacy initial rendering (not browser acceptance)", () => {
  it("renders the student request form without guardian subject selection", () => {
    const html = renderToStaticMarkup(createElement(PrivacyRequests));
    expect(html).toContain('name="message"'); expect(html).toContain('value="DELETE"');
    expect(html).not.toContain('name="subjectId"'); expect(html).not.toContain('name="status"');
    expect(html).toContain("does not immediately erase or export");
  });
  it("offers verified guardians a subject field without implying authority", () => {
    const html = renderToStaticMarkup(createElement(PrivacyRequests, { guardian: true }));
    expect(html).toContain('name="subjectId"'); expect(html).not.toContain('name="reviewerId"');
  });
  it("renders the operator queue without a request-creation form", () => {
    const html = renderToStaticMarkup(createElement(PrivacyRequests, { operator: true }));
    expect(html).toContain("Account privacy queue"); expect(html).not.toContain('name="kind"');
  });
  it("keeps student age selection but does not let parents self-select minor status", () => {
    const student = renderToStaticMarkup(createElement(AccountConsent));
    const parent = renderToStaticMarkup(createElement(AccountConsent, { accountRole: "PARENT" }));
    expect(student).toContain("Age group"); expect(student).toContain("Under 13");
    expect(parent).not.toContain("Under 13"); expect(parent).toContain("verified adulthood");
  });
  it.each([Privacy, Terms])("identifies the supplied company while retaining draft policy status", Page => {
    const html = renderToStaticMarkup(createElement(Page));
    expect(html).toContain(ACCOUNT_OPERATING_ENTITY); expect(html).toContain(ACCOUNT_POLICY_VERSION);
    expect(html.toLowerCase()).toContain("draft"); expect(html).toContain("/account/privacy-requests");
  });
});
