import { levelForPapers, mockMonthlyActive, paperCount } from "@/shared/daily-workload";
import Link from "next/link";
import { Icon } from "@/components/platform/Icon";
import { ProfileForm } from "@/components/platform/app/ProfileForm";
import { PasswordSettings } from "@/components/platform/app/PasswordSettings";
import { requireAuth } from "@/server/auth/session";
import { getCandidateProfile } from "@/server/platform/insights";
import { formatDate, levelLabel } from "@/server/platform/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireAuth();
  const profile = await getCandidateProfile(user.id);
  if (!profile) {
    return <div className="tp-empty"><h3>Profile not found</h3></div>;
  }

  const monthly = mockMonthlyActive(profile.subscription);
  const expiredMock = profile.subscription?.plan === "MOCK_MONTHLY" && !monthly;
  const initials = profile.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");

  return (
    <>
      <div className="tp-page-head">
        <div>
          <div className="tp-eyebrow">Account</div>
          <h1>Your profile</h1>
          <p>Signed in as {profile.email}. Member since {formatDate(profile.createdAt, { month: "long", year: "numeric" })}.</p>
        </div>
        <Link className="tp-btn tp-btn-ghost" href="/app/exams">Manage exams</Link>
      </div>

      <div className="tp-dash">
        <div className="tp-stack tp-gap-20">
          <ProfileForm
            defaults={{
              name: profile.name,
              dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.toISOString().slice(0, 10) : "",
              gender: profile.gender ?? "PREFER_NOT_TO_SAY",
              state: profile.state ?? "Kerala",
              city: profile.city ?? "",
              education: profile.education ?? "Graduate",
              preferredLanguage: profile.preferredLanguage ?? "en",
              phone: profile.phone ?? "",
              avatarUrl: profile.avatarUrl ?? "",
              dailyStudyMinutes: profile.dailyStudyMinutes ?? 45,
              timezone: profile.timezone ?? "Asia/Kolkata",
            }}
          />
          <PasswordSettings />
        </div>

        <aside className="tp-stack tp-gap-20">
          <section className="tp-card tp-card-pad tp-center">
            <span className="tp-avatar" style={{ marginInline: "auto", width: 78, height: 78, fontSize: 28 }}>
              {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : initials || "T"}
            </span>
            <h2 style={{ fontSize: 19, marginTop: 12 }}>{profile.name}</h2>
            <p className="tp-xs tp-muted">{profile.email}</p>
            <div className="tp-row tp-gap-8 tp-wrap" style={{ justifyContent: "center", marginTop: 12 }}>
              <span className="tp-pill tp-pill-brand">{expiredMock ? "FREE" : profile.subscription?.plan ?? "FREE"} plan</span>
              <span className="tp-pill">{profile.accountConsent?.ageBand?.replace(/_/g, "+") ?? "18+"}</span>
            </div>
          </section>

          <section className="tp-card tp-card-pad">
            <h3 style={{ fontSize: 16, marginBottom: 12 }}>Exam plan</h3>
            <div className="tp-stack tp-gap-12">
              {profile.candidateExamTargets.length ? profile.candidateExamTargets.map((target) => (
                <div className="tp-row-between tp-small" key={target.id}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{target.exam.name}</div>
                    <div className="tp-xs tp-faint">Target {target.targetYear}</div>
                  </div>
                  <span className="tp-pill tp-pill-brand">{levelLabel(levelForPapers(paperCount(target.preparationLevel, target.dailyPaperCount, monthly)))}</span>
                </div>
              )) : <p className="tp-small tp-muted">No exam added yet.</p>}
            </div>
            <Link className="tp-btn tp-btn-soft tp-btn-sm tp-btn-block tp-mt-16" href="/app/exams">Change exams and levels</Link>
          </section>

          <section className="tp-card tp-card-pad">
            <h3 style={{ fontSize: 16, marginBottom: 10 }}>Account & privacy</h3>
            <div className="tp-stack tp-gap-8">
              <div className="tp-row-between tp-small"><span className="tp-muted">Consent version</span><span style={{ fontWeight: 600 }}>{profile.accountConsent?.acceptedAt ? formatDate(profile.accountConsent.acceptedAt, { day: "numeric", month: "short", year: "numeric" }) : "—"}</span></div>
              <div className="tp-row-between tp-small"><span className="tp-muted">Subscription</span><span style={{ fontWeight: 600 }}>{expiredMock ? "EXPIRED" : profile.subscription?.status ?? "ACTIVE"}</span></div>
              <div className="tp-row-between tp-small"><span className="tp-muted">Study time</span><span style={{ fontWeight: 600 }}>{profile.dailyStudyMinutes ?? 45} min/day</span></div>
            </div>
            <div className="tp-row tp-gap-8 tp-mt-16 tp-wrap">
              <Link className="tp-btn tp-btn-ghost tp-btn-sm" href="/privacy">Privacy notice</Link>
              <Link className="tp-btn tp-btn-ghost tp-btn-sm" href="/account/privacy-requests">Data requests</Link>
            </div>
          </section>

          <div className="tp-note">
            <strong>Self-registration policy.</strong> This build accepts candidates aged 18 and over. Accounts for
            younger candidates require verified guardian consent, which is not enabled.
          </div>
        </aside>
      </div>
    </>
  );
}
