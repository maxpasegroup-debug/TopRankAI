import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/components/journey/client", () => ({ studentRequest: vi.fn(), StudentRequestError: class extends Error {} }));
import { AdminMocks } from "@/components/mock/AdminMocks";
import { MockDirectory, MockWorkspace } from "@/components/mock/StudentMocks";

describe("mock initial SSR shells, not browser acceptance", () => {
  it("offers draft authoring and explicit review evidence", () => {
    const html = renderToStaticMarkup(<AdminMocks />);
    expect(html).toContain("Save draft"); expect(html).toContain("Review evidence");
    expect(html).toContain('href="/admin/content"'); expect(html).not.toContain("Review complete");
  });
  it("does not fabricate an attempt or result before loading", () => {
    const html = renderToStaticMarkup(<MockWorkspace attemptId="attempt" />);
    expect(html).toContain("Loading attempt..."); expect(html).not.toContain("numericalAnswer");
    expect(html).not.toContain("Exam submitted.");
  });
  it("connects the directory to revision and progress", () => {
    const html = renderToStaticMarkup(<MockDirectory />);
    expect(html).toContain('href="/practice/revision"'); expect(html).toContain('href="/progress"');
    expect(html).toContain("Loading mock exams...");
  });
});
