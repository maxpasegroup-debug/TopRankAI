import Link from "next/link";
import { Icon, type IconName } from "@/components/platform/Icon";
import { getAdminOverview } from "@/server/admin/platform-admin";
import { formatDate, formatDateTime, toNumber } from "@/server/platform/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin overview" };

const quickLinks: { href: string; label: string; body: string; icon: IconName }[] = [
  { href: "/admin/exams", label: "Exam catalogue", body: "Create exams, categories and marking models.", icon: "target" },
  { href: "/admin/questions", label: "Question bank", body: "Review, approve and author practice questions.", icon: "layers" },
  { href: "/admin/syllabus", label: "Syllabus library", body: "Maintain units, chapters and topics.", icon: "book" },
  { href: "/admin/calendar", label: "Exam calendar", body: "Record verified dates with official sources.", icon: "calendar" },
  { href: "/admin/candidates", label: "Candidates", body: "Inspect plans and suspend abusive accounts.", icon: "user" },
  { href: "/admin/ai", label: "AI operations", body: "Provider status, usage and recent calls.", icon: "cpu" },
];

export default async function AdminOverviewPage() {
  const data = await getAdminOverview();
  const { counts } = data;

  return (
    <>
      <div className="tp-page-head">
        <div>
          <div className="tp-eyebrow">Operations</div>
          <h1>Platform overview</h1>
          <p>Platform activity at a glance.</p>
        </div>
        <div className="tp-row tp-gap-8 tp-wrap">
          <span className={`tp-pill ${data.ai.enabled ? "tp-pill-ok" : "tp-pill-warn"}`}>
            <Icon name="cpu" size={13} /> AI {data.ai.enabled ? "active" : "inactive"}
          </span>
          <Link className="tp-btn tp-btn-ghost tp-btn-sm" href="/admin/ai">AI details</Link>
        </div>
      </div>

      <div className="tp-admin-grid tp-mb-24">
        {[
          { label: "Candidate accounts", value: counts.users, note: "Administrators excluded" },
          { label: "Active exams", value: counts.exams, note: "Published and accepting plans" },
          { label: "Questions", value: counts.questions, note: `${counts.pendingQuestions} awaiting review` },
          { label: "Syllabus topics", value: counts.topics, note: "Across all active exams" },
          { label: "Papers today", value: counts.attemptsToday, note: "Submitted since midnight UTC" },
          { label: "AI calls today", value: counts.aiToday, note: "Every call is logged" },
          { label: "Upcoming dates", value: counts.calendar, note: "Verified calendar events" },
        ].map((item) => (
          <div className="tp-admin-stat" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <span>{item.note}</span>
          </div>
        ))}
      </div>

      <div className="tp-grid tp-grid-2 tp-mb-24" style={{ alignItems: "start" }}>
        <section className="tp-card tp-card-pad">
          <div className="tp-row-between" style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: 17 }}>Recent registrations</h2>
            <Link className="tp-btn tp-btn-ghost tp-btn-sm" href="/admin/candidates">All candidates</Link>
          </div>
          {data.recentUsers.length ? (
            <div className="tp-table-wrap" style={{ border: 0 }}>
              <table className="tp-table">
                <thead>
                  <tr><th>Name</th><th>Role</th><th>Status</th><th>Joined</th></tr>
                </thead>
                <tbody>
                  {data.recentUsers.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{user.name}</div>
                        <div className="tp-xs tp-faint">{user.email}</div>
                      </td>
                      <td className="tp-xs">{user.role.replace(/_/g, " ").toLowerCase()}</td>
                      <td><span className={`tp-pill ${user.status === "ACTIVE" ? "tp-pill-ok" : "tp-pill-danger"}`}>{user.status.toLowerCase()}</span></td>
                      <td className="tp-nowrap tp-xs">{formatDate(user.createdAt, { day: "numeric", month: "short" })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="tp-small tp-muted">No accounts yet.</p>
          )}
        </section>

        <section className="tp-card tp-card-pad">
          <div className="tp-row-between" style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: 17 }}>Recent submissions</h2>
            <Link className="tp-btn tp-btn-ghost tp-btn-sm" href="/admin/candidates">Candidates</Link>
          </div>
          {data.recentAttempts.length ? (
            <div className="tp-table-wrap" style={{ border: 0 }}>
              <table className="tp-table">
                <thead>
                  <tr><th>Candidate</th><th>Exam</th><th>Score</th><th>Accuracy</th><th>When</th></tr>
                </thead>
                <tbody>
                  {data.recentAttempts.map((attempt) => (
                    <tr key={attempt.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{attempt.user.name}</div>
                        <div className="tp-xs tp-faint">{attempt.user.email}</div>
                      </td>
                      <td className="tp-xs">{attempt.exam.code}</td>
                      <td>{toNumber(attempt.obtainedMarks)}/{toNumber(attempt.totalMarks)}</td>
                      <td>{toNumber(attempt.accuracy).toFixed(1)}%</td>
                      <td className="tp-nowrap tp-xs">{formatDate(attempt.submittedAt, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="tp-small tp-muted">No submitted paper yet.</p>
          )}
        </section>
      </div>

      <section className="tp-mb-24">
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Manage the platform</h2>
        <div className="tp-grid tp-grid-3">
          {quickLinks.map((link) => (
            <Link className="tp-card tp-card-pad" href={link.href} key={link.href} style={{ color: "inherit" }}>
              <span className="tp-feature-icon" style={{ margin: 0, width: 38, height: 38, borderRadius: 11 }}>
                <Icon name={link.icon} size={18} />
              </span>
              <h3 style={{ fontSize: 15, margin: "10px 0 4px" }}>{link.label}</h3>
              <p className="tp-xs tp-muted" style={{ lineHeight: 1.55 }}>{link.body}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="tp-card tp-card-pad">
        <div className="tp-row-between" style={{ marginBottom: 12 }}>
          <div>
            <h2 style={{ fontSize: 17 }}>Recent AI calls</h2>
            <p className="tp-xs tp-faint" style={{ marginTop: 3 }}>
              {data.ai.enabled ? `${data.ai.provider} Â· ${data.ai.model}` : "AI-assisted wording is currently off"}
            </p>
          </div>
          <Link className="tp-btn tp-btn-ghost tp-btn-sm" href="/admin/ai">Open log</Link>
        </div>
        {data.aiLogs.length ? (
          <div className="tp-table-wrap" style={{ border: 0 }}>
            <table className="tp-table">
              <thead>
                <tr><th>Operation</th><th>Outcome</th><th>Latency</th><th>When</th></tr>
              </thead>
              <tbody>
                {data.aiLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="tp-xs">{log.operation.replace(/_/g, " ").toLowerCase()}</td>
                    <td><span className={`tp-pill ${log.success ? "tp-pill-ok" : "tp-pill-danger"}`}>{log.success ? "ok" : "failed"}</span></td>
                    <td className="tp-xs">{log.latencyMs ? `${log.latencyMs} ms` : "â€”"}</td>
                    <td className="tp-nowrap tp-xs">{formatDateTime(log.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="tp-small tp-muted">No AI call has been recorded yet.</p>
        )}
      </section>
    </>
  );
}

