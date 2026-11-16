import Link from "next/link";
import { Icon, type IconName } from "@/components/platform/Icon";
import { requireAuth } from "@/server/auth/session";
import { getAchievementProgress } from "@/server/platform/achievements";
import { formatDate, percent } from "@/server/platform/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Achievements" };

const knownIcons = new Set<IconName>(["trophy", "flame", "target", "star", "medal", "book", "chart", "check", "spark", "shield", "compass"]);

function iconName(value: string): IconName {
  return knownIcons.has(value as IconName) ? (value as IconName) : "medal";
}

export default async function AchievementsPage() {
  const user = await requireAuth();
  const progress = await getAchievementProgress(user.id);
  const earned = progress.items.filter((item) => item.earned);
  const locked = progress.items.filter((item) => !item.earned);

  return (
    <>
      <div className="tp-page-head">
        <div>
          <div className="tp-eyebrow">Milestones</div>
          <h1>Achievements</h1>
          <p>Badges unlock from recorded activity only — papers, accuracy, streaks and syllabus progress.</p>
        </div>
        <div className="tp-row tp-gap-8 tp-wrap">
          <span className="tp-pill tp-pill-brand">{earned.length} earned</span>
          <span className="tp-pill"><Icon name="spark" size={13} /> {progress.totalXp} XP</span>
        </div>
      </div>

      <div className="tp-grid tp-grid-3 tp-mb-24">
        <div className="tp-stat">
          <div className="tp-stat-label"><Icon name="trophy" size={15} /> Unlocked</div>
          <div className="tp-stat-value">{earned.length}<small> / {progress.items.length}</small></div>
          <div className="tp-meter tp-meter-accent tp-mt-8"><span style={{ width: `${percent(earned.length, progress.items.length)}%` }} /></div>
        </div>
        <div className="tp-stat">
          <div className="tp-stat-label"><Icon name="spark" size={15} /> Experience</div>
          <div className="tp-stat-value">{progress.totalXp}<small> XP</small></div>
          <div className="tp-stat-note">From unlocked achievements</div>
        </div>
        <div className="tp-stat">
          <div className="tp-stat-label"><Icon name="target" size={15} /> Still to earn</div>
          <div className="tp-stat-value">{locked.length}</div>
          <div className="tp-stat-note">Keep the daily loop going</div>
        </div>
      </div>

      {earned.length ? (
        <section className="tp-mb-24">
          <h2 style={{ fontSize: 20, marginBottom: 12 }}>Earned</h2>
          <div className="tp-grid tp-grid-3">
            {earned.map((item) => (
              <article className="tp-badge-card" key={item.code}>
                <span className="tp-badge-icon"><Icon name={iconName(item.icon)} /></span>
                <div>
                  <h4>{item.title}</h4>
                  <p>{item.description}</p>
                  <div className="tp-xs tp-faint" style={{ marginTop: 6 }}>
                    {item.earnedAt ? `Earned ${formatDate(item.earnedAt, { day: "numeric", month: "short", year: "numeric" })}` : "Earned"} · {item.xp} XP
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 style={{ fontSize: 20, marginBottom: 12 }}>{earned.length ? "In progress" : "All milestones"}</h2>
        {locked.length ? (
          <div className="tp-grid tp-grid-3">
            {locked.map((item) => {
              const value = Math.min(item.value, item.threshold);
              return (
                <article className="tp-badge-card" data-locked="true" key={item.code}>
                  <span className="tp-badge-icon"><Icon name={iconName(item.icon)} /></span>
                  <div className="tp-grow">
                    <h4>{item.title}</h4>
                    <p>{item.description}</p>
                    <div className="tp-meter tp-mt-8"><span style={{ width: `${percent(value, item.threshold)}%` }} /></div>
                    <div className="tp-xs tp-faint" style={{ marginTop: 5 }}>
                      {item.metric === "ACCURACY" ? `${item.value}% of ${item.threshold}%` : `${value} of ${item.threshold}`} · {item.xp} XP
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="tp-empty">
            <span className="tp-feature-icon" style={{ margin: 0 }}><Icon name="trophy" /></span>
            <h3>Every milestone unlocked</h3>
            <p>You have earned every active achievement. New milestones are added as the platform grows.</p>
            <Link className="tp-btn tp-btn-soft" href="/app/daily">Keep practising</Link>
          </div>
        )}
      </section>

      <div className="tp-note tp-mt-24">
        <strong>No participation trophies.</strong> Achievements are evaluated after a paper is submitted or a topic
        is marked complete. They are never granted by visiting a page.
      </div>
    </>
  );
}
