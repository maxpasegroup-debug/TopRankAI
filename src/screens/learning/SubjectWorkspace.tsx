import { ChapterCard } from "../../components/learning/ChapterCard";
import { ContinueLearningCard } from "../../components/learning/ContinueLearningCard";
import { ResourceCard } from "../../components/learning/ResourceCard";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageContainer } from "../../components/ui/PageContainer";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { chapters, quickRevision } from "../../data/learning";
import type { ContentChapterDto, ContentSubjectDto } from "../../server/content/service";

type SubjectWorkspaceProps = {
  subject: "Physics" | "Chemistry" | "Biology" | string;
  contentSubject?: ContentSubjectDto;
  contentChapters?: ContentChapterDto[];
};

export function SubjectWorkspace({ subject, contentSubject, contentChapters }: SubjectWorkspaceProps) {
  if (contentSubject) return <PageContainer><main className="journey-shell">
    <nav aria-label="Learning breadcrumb"><Button href="/learn" variant="secondary">Learning</Button></nav>
    <h1>{contentSubject.name}</h1>
    {(contentChapters ?? []).length ? <ul className="journey-task-list">{contentChapters!.map(chapter => <li key={chapter.slug}><div><strong>{chapter.title}</strong><p>{chapter.summary}</p></div><Button href={chapter.href}>Open chapter</Button></li>)}</ul> : <p>No published chapters yet.</p>}
  </main></PageContainer>;
  const progress = subject === "Physics" ? 62 : subject === "Chemistry" ? 44 : 100;
  const displayChapters = chapters;

  return (
    <PageContainer>
      <div className="screen-stack">
        <SectionHeader
          eyebrow={subject}
          title={`${subject} workspace`}
          subtitle="Your learning mission, chapters, and activity in one clean place."
          action={<Button href={displayChapters[0]?.href ?? "/learn"}>Continue Learning</Button>}
        />
        <Card>
          <div className="subject-hero">
            <div>
              <p className="eyebrow">Progress</p>
              <h2 className="subject-progress">{progress}%</h2>
            </div>
            <ProgressBar value={progress} />
          </div>
        </Card>
        <ContinueLearningCard />
        <Card soft>
          <h2 className="learning-card-title">Today's Mission</h2>
          <p className="card-copy">Finish Motion basics and revise three formulas.</p>
        </Card>
        <SectionHeader eyebrow="Topics" title="Chapters" />
        <div className="grid grid-3">
          {displayChapters.map((chapter) => (
            <ChapterCard chapter={chapter} key={chapter.title} />
          ))}
        </div>
        <SectionHeader eyebrow="Recent Activity" title="Fresh from your study table" />
          <div className="grid grid-2">
            {quickRevision.slice(0, 2).map((resource) => (
              <ResourceCard resource={resource} key={resource.title} />
            ))}
          </div>
      </div>
    </PageContainer>
  );
}
