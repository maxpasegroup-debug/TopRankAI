import { Icon } from "@/components/platform/Icon";
import { getAdminAiPage } from "@/server/admin/platform-admin";
import { formatDateTime } from "@/server/platform/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI operations" };

export default async function AdminAiPage() {
  const { config, logs, usage } = await getAdminAiPage();
  const totalCalls = usage.reduce((sum, row) => sum + row._count._all, 0);
  const failures = usage.filter((row) => !row.success).reduce((sum, row) => sum + row._count._all, 0);

  return (
    <>
      <div className="tp-page-head">
        <div>
          <div className="tp-eyebrow">Operations</div>
          <h1>AI operations</h1>
          <p>Provider status and an honest record of every AI call. AI never calculates marks or ranks.</p>
        </div>
        <span className={`tp-pill ${config.enabled ? "tp-pill-ok" : "tp-pill-warn"}`}>
          <Icon name="cpu" size={14} /> {config.enabled ? "Active" : "Inactive"}
        </span>
      </div>

      <div className="tp-admin-grid tp-mb-24">
        <div className="tp-admin-stat">
          <span>Provider</span>
          <strong style={{ fontSize: 20 }}>{config.provider === "google" ? "Google Gemini" : config.provider}</strong>
          <span>{config.model}</span>
        </div>
        <div className="tp-admin-stat">
          <span>Recorded calls</span>
          <strong>{totalCalls}</strong>
          <span>{failures} failed</span>
        </div>
        <div className="tp-admin-stat">
          <span>Scoring</span>
          <strong style={{ fontSize: 20 }}>Deterministic</strong>
          <span>Never calculated by AI</span>
        </div>
      </div>

      <div className="tp-grid tp-grid-2 tp-mb-24" style={{ alignItems: "start" }}>
        <section className="tp-card tp-card-pad">
          <h2 style={{ fontSize: 17, marginBottom: 10 }}>What AI handles</h2>
          <div className="tp-stack tp-gap-10 tp-small tp-muted">
            <p>Feedback wording for submitted papers.</p>
            <p>Study notes and daily plan suggestions.</p>
            <p>Draft questions that an administrator must review before publication.</p>
          </div>
          <div className="tp-note tp-mt-16">
            <strong>Never scored by AI.</strong> Marks, accuracy, readiness scores and streaks are computed by the
            deterministic server code.
          </div>
        </section>

        <section className="tp-card tp-card-pad">
          <h2 style={{ fontSize: 17, marginBottom: 10 }}>Usage by operation</h2>
          {usage.length ? (
            <div className="tp-table-wrap" style={{ border: 0 }}>
              <table className="tp-table">
                <thead>
                  <tr><th>Operation</th><th>Result</th><th>Calls</th><th>Avg latency</th></tr>
                </thead>
                <tbody>
                  {usage.map((row) => (
                    <tr key={`${row.operation}-${row.success}`}>
                      <td className="tp-xs">{row.operation.replace(/_/g, " ").toLowerCase()}</td>
                      <td><span className={`tp-pill ${row.success ? "tp-pill-ok" : "tp-pill-danger"}`}>{row.success ? "ok" : "failed"}</span></td>
                      <td>{row._count._all}</td>
                      <td className="tp-xs">{row._avg.latencyMs ? `${Math.round(row._avg.latencyMs)} ms` : "â€”"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="tp-small tp-muted">No AI operation has been recorded yet.</p>
          )}
        </section>
      </div>

      <section className="tp-card tp-card-pad">
        <div className="tp-row-between" style={{ marginBottom: 12 }}>
          <div>
            <h2 style={{ fontSize: 17 }}>Recent calls</h2>
            <p className="tp-xs tp-faint" style={{ marginTop: 3 }}>The latest 100 recorded calls, newest first.</p>
          </div>
          <span className="tp-pill">{logs.length}</span>
        </div>
        {logs.length ? (
          <div className="tp-table-wrap" style={{ border: 0 }}>
            <table className="tp-table">
              <thead>
                <tr><th>When</th><th>Operation</th><th>Model</th><th>Outcome</th><th>Latency</th><th>User</th></tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="tp-nowrap tp-xs">{formatDateTime(log.createdAt)}</td>
                    <td className="tp-xs">{log.operation.replace(/_/g, " ").toLowerCase()}</td>
                    <td className="tp-xs">{log.model ?? "â€”"}</td>
                    <td>
                      <span className={`tp-pill ${log.success ? "tp-pill-ok" : "tp-pill-danger"}`}>
                        {log.success ? "ok" : "failed"}
                      </span>
                    </td>
                    <td className="tp-xs">{log.latencyMs ? `${log.latencyMs} ms` : "â€”"}</td>
                    <td className="tp-xs">{log.userId ? `${log.userId.slice(0, 10)}â€¦` : "â€”"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="tp-small tp-muted">Nothing recorded yet.</p>
        )}
      </section>
    </>
  );
}

