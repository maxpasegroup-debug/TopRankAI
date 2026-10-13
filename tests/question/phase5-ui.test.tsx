import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/components/journey/client", () => ({ studentRequest: vi.fn() }));
import { QuestionBank } from "@/components/learning/QuestionBank";
import { PracticeRevision } from "@/components/practice/PracticeRevision";
import { AnswerSubmission } from "@/components/practice/AnswerSubmission";
describe("Phase 5 initial SSR shells, not browser acceptance", () => {
  it("offers a functional question draft form and does not fabricate reviews", () => { const html = renderToStaticMarkup(<QuestionBank />); expect(html).toContain("Save draft"); expect(html).toContain("Permission evidence"); expect(html).not.toContain("educator-reviewed library ready"); });
  it("connects practice revision, history and daily planning", () => { const html = renderToStaticMarkup(<PracticeRevision />); expect(html).toContain("Mistake-to-Mastery"); expect(html).toContain('href="/practice/review"'); expect(html).toContain('href="/home"'); });
  it("escapes question choices and starts disabled until recovery is checked", () => {
    const html = renderToStaticMarkup(<AnswerSubmission ownerId="student" question={{ id: "q", code: "Q", text: "Question", type: "SINGLE_CHOICE", difficulty: "EASY", subject: { code: null, name: "Subject", slug: "subject" }, chapter: { title: "Chapter", slug: "chapter" }, lesson: null, exams: [], tags: [], options: [{ id: "a", code: "A", text: "<script>bad()</script>", order: 0 }] }} />);
    expect(html).toContain("&lt;script&gt;"); expect(html).not.toContain("<script>"); expect(html).toContain('disabled=""');
  });
});
