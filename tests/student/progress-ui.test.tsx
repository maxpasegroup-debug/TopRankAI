import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/components/journey/client", () => ({ studentRequest: vi.fn() }));
vi.mock("@/components/competition/CompetitionWorkspace", () => ({ AchievementHistory: () => null }));
import { ProgressDashboard, ProgressEvidence } from "@/components/journey/ProgressDashboard";
import type { getStudentEvidence } from "@/server/journey/progress";
import { summarizeEvidence } from "@/shared/progress-evidence";
const now = new Date("2026-10-11T12:00:00Z");
const data = () => ({ completedTasks: 0, completedLessons: 0, recordedMinutes: 0, sessions: [], saved: [], profile: { displayName: "<script>bad()</script>", targetExam: null }, asOf: now.toISOString(), guidance: { suggestion: "Review your board", href: "/home" }, totals: { practiceAttempts: 0, practiceCorrect: 0, finalizedMocks: 0 }, truncated: { practice: false }, evidence: summarizeEvidence({ sessions: [], missions: [], lessons: [], practice: [], mocks: [] }, "Asia/Kolkata", now) }) as unknown as Awaited<ReturnType<typeof getStudentEvidence>>;
describe("progress SSR evidence, not browser acceptance", () => {
  it("loads privately with timezone and connected history controls", () => { const html = renderToStaticMarkup(<ProgressDashboard />); expect(html).toContain("India"); expect(html).toContain("UAE"); expect(html).toContain("Loading progress..."); expect(html).toContain('href="/practice/review"'); expect(html).not.toContain("guaranteed rank"); });
  it("escapes names and distinguishes empty evidence from mastery", () => { const html = renderToStaticMarkup(<ProgressEvidence data={data()} />); expect(html).toContain("&lt;script&gt;"); expect(html).not.toContain("<script>"); expect(html).toContain("No attempts"); expect(html).toContain("not proof of mastery"); expect(html).toContain("No recorded activity"); expect(html).not.toContain("100%"); });
  it("shows truncation and invalid-result warnings", () => { const value = data(); value.truncated.practice = true; value.evidence.invalidMockResults = 1; const html = renderToStaticMarkup(<ProgressEvidence data={value} />); expect(html).toContain("trends may be incomplete"); expect(html).toContain("results need verification"); });
  it("links the actual next action and revision", () => { const html = renderToStaticMarkup(<ProgressEvidence data={data()} />); expect(html).toContain('href="/home"'); expect(html).toContain('href="/practice/revision"'); expect(html).toContain("Last 28 days"); });
});
