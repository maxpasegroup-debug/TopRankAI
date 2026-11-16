import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageContainer } from "../components/ui/PageContainer";
import { SectionHeader } from "../components/ui/SectionHeader";
import type { StudentProfileDto } from "../server/student/service";

type MeProps = {
  profile?: StudentProfileDto;
};

export function Me({ profile }: MeProps) {
  return (
    <PageContainer>
      <div className="screen-stack">
        <SectionHeader
          eyebrow="Me"
          title="Your preparation profile"
          subtitle="This is now connected to your authenticated TopRank account."
          action={<Button href="/mission/exam">Edit profile</Button>}
        />
        <Card>
          <Badge>Student</Badge>
          <h2 style={{ margin: "18px 0 8px", fontSize: 30 }}>{profile?.name ?? "Student"}</h2>
          <p style={{ margin: 0, color: "var(--color-muted)", lineHeight: 1.55 }}>
            Preparing for {profile?.targetExam?.name ?? "your selected exam"} {profile?.targetYear ?? ""} with{" "}
            {profile?.dreamCollege ?? "a saved goal"} as the dream.
          </p>
          <div className="profile-detail-grid">
            <span>Email: {profile?.email ?? "Not available"}</span>
            <span>Phone: {profile?.phone ?? "Not added"}</span>
            <span>Daily study: {profile?.dailyStudyHours ? `${profile.dailyStudyHours} hours` : "Not set"}</span>
            <span>Status: {profile?.onboardingCompleted ? "Onboarding complete" : "Onboarding pending"}</span>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
