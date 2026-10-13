import { ContinueLearningCard } from "../components/learning/ContinueLearningCard";
import { GlobalSearchLauncher } from "../components/polish/GlobalSearchLauncher";
import { ResourceCard } from "../components/learning/ResourceCard";
import { SearchBar } from "../components/learning/SearchBar";
import { SubjectCard } from "../components/learning/SubjectCard";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { PageContainer } from "../components/ui/PageContainer";
import { SectionHeader } from "../components/ui/SectionHeader";
import { quickRevision, todaySubjects } from "../data/learning";
import type { ContentExamDto, ContentSubjectDto } from "../server/content/service";

type LearnProps = {
  exam?: ContentExamDto | null;
  subjects?: ContentSubjectDto[];
};

const subjectColors = ["blue", "amber", "green"] as const;

export function Learn({ exam, subjects }: LearnProps) {
  if (subjects) return <PageContainer><main className="journey-shell"><span className="journey-kicker">LEARN</span><h1>{exam?.name ?? "Your learning path"}</h1>
    <div className="journey-actions"><Button href="/learn/catalogue" variant="secondary">Exam catalogue</Button><Button href="/practice">Practice</Button><Button href="/progress" variant="secondary">Saved lessons</Button><Button href="/learn/saved" variant="secondary">Saved resources</Button></div>
    {subjects.length ? <ul className="journey-task-list">{subjects.map((subject) => <li key={subject.slug}><strong>{subject.name}</strong><Button href={subject.href} variant="secondary">Open subject</Button></li>)}</ul> : <p>No published subjects are available for your exam yet.</p>}
  </main></PageContainer>;
  const isProduction = false;
  const displaySubjects = todaySubjects;

  return (
    <PageContainer>
      <div className="screen-stack">
        <SectionHeader
          eyebrow="Today's Learning"
          title={exam ? `${exam.name} learning path` : "One calm study plan for today"}
          subtitle={isProduction ? "Subjects are loaded from your saved exam content." : "Only the subjects you need today. No clutter."}
          action={<Button href="/learn/search">Search</Button>}
        />
        <SearchBar />
        <GlobalSearchLauncher />
        <div className="grid grid-3">
          {displaySubjects.map((subject) => (
            <SubjectCard subject={subject} key={subject.name} />
          ))}
        </div>
        <ContinueLearningCard />
        <SectionHeader
          eyebrow="Quick Revision"
          title="Revise before you forget"
          action={<Button href="/learn/revision" variant="secondary">Open revision</Button>}
        />
        <div className="grid grid-3">
          {quickRevision.slice(0, 3).map((resource) => (
            <ResourceCard resource={resource} key={resource.title} />
          ))}
        </div>
        <EmptyState
          title={isProduction && displaySubjects.length === 0 ? "Content is being prepared" : "No bookmarks yet"}
          text={isProduction && displaySubjects.length === 0 ? "Published content for your selected exam is not available yet." : "Saved lessons and revision cards will appear here later."}
          actionLabel="Continue Learning"
          actionHref={displaySubjects[0]?.href ?? "/learn"}
        />
      </div>
    </PageContainer>
  );
}
