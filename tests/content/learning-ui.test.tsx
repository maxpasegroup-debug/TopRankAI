import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SubjectWorkspace } from "@/screens/learning/SubjectWorkspace";
import { LessonExperience } from "@/screens/learning/LessonExperience";
import type { LessonDetailDto } from "@/server/content/service";
vi.mock("@/components/journey/LessonActions", () => ({ LessonActions: () => <span>Lesson actions</span> }));
vi.mock("@/components/learning/SavedResources", () => ({ ResourceSaveButton: () => <span>Save resource</span> }));
describe("learning server rendering", () => {
  it("shows real published chapters without invented progress or demo missions", () => {
    const html = renderToStaticMarkup(<SubjectWorkspace subject="Physics" contentSubject={{ code: "PHYSICS", slug: "physics", name: "Physics", href: "/learn/physics" }} contentChapters={[{ title: "Kinematics", slug: "motion", href: "/learn/physics/motion", summary: "Motion", order: 1 }]} />);
    expect(html).toContain("Kinematics"); expect(html).not.toContain("62%"); expect(html).not.toContain("Today&#x27;s Mission"); expect(html).not.toContain("Finish Motion basics");
  });
  it("has a truthful empty chapter state", () => { const html = renderToStaticMarkup(<SubjectWorkspace subject="Physics" contentSubject={{ code: "PHYSICS", slug: "physics", name: "Physics", href: "/learn/physics" }} contentChapters={[]} />); expect(html).toContain("No published chapters"); });
  it("renders structured teaching text as escaped text, not executable HTML", () => {
    const lesson: LessonDetailDto = { id: "l1", title: "Lesson", slug: "lesson", summary: "", href: "/learn/physics/motion/lesson", order: 1, subject: { code: "PHYSICS", name: "Physics", slug: "physics", href: "/learn/physics" }, chapter: { title: "Motion", slug: "motion", summary: "", order: 1, href: "/learn/physics/motion" },
      resources: [], body: { version: 1, sourceNote: "Original source", sections: [{ kind: "CONCEPT", title: "Concept", text: "<script>alert('unsafe')</script>" }] } };
    const html = renderToStaticMarkup(<LessonExperience lesson={lesson} />); expect(html).toContain("&lt;script&gt;"); expect(html).not.toContain("<script>"); expect(html).toContain("Concept");
  });
});
