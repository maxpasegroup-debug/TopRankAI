import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AuthPage } from "@/screens/AuthPages";

describe("public signup UI", () => {
  it("renders mobile and masked PIN login with recovery and legacy-account access", () => {
    const html = renderToStaticMarkup(createElement(AuthPage, { mode: "login" }));
    expect(html).toContain('name="phone"'); expect(html).toContain('name="pin"'); expect(html).toContain('type="password"');
    expect(html).toContain("Forgot PIN?"); expect(html).toContain("Existing password account / staff"); expect(html).not.toContain('name="email"');
  });
  it("renders student registration without any public role selection", () => {
    const html = renderToStaticMarkup(createElement(AuthPage, { mode: "signup" }));
    expect(html).toContain("SIA");
    expect(html).toContain("dialog");
    expect(html).toContain('name="name"');
    expect(html).toContain('name="phone"');
    expect(html).not.toContain('name="email"');
    expect(html).not.toContain('name="password"');
    expect(html).not.toContain('name="role"');
    expect(html).not.toMatch(/PLATFORM_ADMIN|TEACHER|PARENT|SCHOOL_ADMIN/);
  });
});
