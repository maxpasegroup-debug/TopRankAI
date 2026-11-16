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
          <Icon name="cpu" size={14} /> {config.enabled ? "Configured" : "Not configured"}
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
          <span>API key</span>
          <strong style={{ fontSize: 20 }}>{config.hasKey ? "Present" : "Missing"}</strong>
          <span>Read from GEMINI_API_KEY</span>
        </div>
        <div className="tp-admin-stat">
          <span>Fallback</span>
          <strong style={{ fontSize: 20 }}>Deterministic</strong>
          <span>Used when AI is unavailable</span>
        </div>
      </div>

      <div className="tp-grid tp-grid-2 tp-mb-24" style={{ alignItems: "start" }}>
        <section className="tp-card tp-card-pad">
          <h2 style={{ fontSize: 17, marginBottom: 10 }}>How to enable AI</h2>
          <ol className="tp-stack tp-gap-10 tp-small tp-muted" style={{ paddingLeft: 18 }}>
            <li>Create a free Google AI Studio API key at <a className="tp-link" href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">aistudio.google.com/app/apikey</a>.</li>
            <li>Add <code>GEMINI_API_KEY=â€¦</code> to <code>.env</code> and restart the server.</li>
            <li>Optionally set <code>GEMINI_MODEL</code> (default <code>gemini-3.5-flash</code>).</li>
            <li>Set <code>AI_FEATURES_ENABLED=false</code> to turn every AI feature off without removing the key.</li>
          </ol>
          <div className="tp-note tp-mt-16">
            <strong>What AI does here.</strong> Feedback wording, study notes, plan suggestions and draft questions.
            Marks, accuracy, readiness scores and streaks are computed by the deterministic server code.
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
            <p className="tp-small tp-muted">No AI operation has been recorded yet. That is expected when the key is missing.</p>
          )}
          {!config.enabled ? (
            <div className="tp-note tp-mt-16">
              <strong>Current behaviour.</strong> Exam feedback uses a rule-based fallback, study plans are built from
              recorded weak topics, and AI question drafting returns a clear not-configured message.
            </div>
          ) : null}
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

