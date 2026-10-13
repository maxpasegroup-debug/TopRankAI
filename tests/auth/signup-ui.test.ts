import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AuthPage } from "@/screens/AuthPages";

describe("public signup UI", () => {
  it("renders student registration without any public role selection", () => {
    const html = renderToStaticMarkup(createElement(AuthPage, { mode: "signup" }));
    expect(html).toContain("Age group");
    expect(html).toContain("Under 13");
    expect(html).toContain("13 to 17");
    expect(html).not.toContain('name="email"');
    expect(html).not.toContain('name="password"');
    expect(html).not.toContain('name="role"');
    expect(html).not.toMatch(/PLATFORM_ADMIN|TEACHER|PARENT|SCHOOL_ADMIN/);
  });
});
