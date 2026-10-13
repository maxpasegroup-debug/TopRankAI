"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { studentRequest } from "@/components/journey/client";
import type { launchOverview, listEntitlements, listOperationalAudit } from "@/server/operations/launch";
type Overview = Awaited<ReturnType<typeof launchOverview>>;
type Access = Awaited<ReturnType<typeof listEntitlements>>;
type Audit = Awaited<ReturnType<typeof listOperationalAudit>>;
const labels: Record<keyof Overview["counts"], [string, string]> = { openSupport: ["Open support", "/admin"], staleSupport: ["Support unchanged for 48 hours", "/admin"], paymentReview: ["Orders needing review", "/admin/commerce"], eventRetry: ["Payment events needing retry", "/admin/commerce"], refundReview: ["Refunds awaiting action", "/admin/commerce"], deliveryProblems: ["External delivery problems", "/admin/commerce"], expiredGrants: ["Grants outside their access window", "/admin/operations"], freePackages: ["Available free pilot packages", "/admin/commerce"] };
export function LaunchOperations() {
  const [view, setView] = useState("overview"), [page, setPage] = useState(1), [refresh, setRefresh] = useState(0);
  const [filters, setFilters] = useState({ userId: "", status: "ALL", entity: "", action: "" });
  const [data, setData] = useState<Overview | Access | Audit | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; setData(null); setError(""); const q = new URLSearchParams({ mode: view, page: String(page) });
    if (view === "access") { q.set("status", filters.status); if (filters.userId) q.set("userId", filters.userId); }
    if (view === "audit") { if (filters.entity) q.set("entity", filters.entity); if (filters.action) q.set("action", filters.action); }
    studentRequest<Overview | Access | Audit>(`/api/admin/operations?${q}`).then(value => { if (active) setData(value); }).catch((e: Error) => { if (active) setError(e.message); }); return () => { active = false; };
  }, [view, page, refresh, filters]);
  function filter(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget); setFilters(old => ({ ...old, ...Object.fromEntries(f.entries()) })); setPage(1); }
  async function revoke(e: FormEvent<HTMLFormElement>, id: string) { e.preventDefault(); const form = e.currentTarget, reason = new FormData(form).get("reason"); if (!window.confirm("Withdraw this feature grant? Other grants are unchanged.")) return; setBusy(true); setError("");
    try { await studentRequest("/api/admin/commerce", "POST", { action: "revoke", id, reason }); form.reset(); setRefresh(n => n + 1); } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to revoke"); } finally { setBusy(false); }
  }
  const overview = view === "overview" ? data as Overview | null : null, access = view === "access" ? data as Access | null : null, audit = view === "audit" ? data as Audit | null : null;
  const paged = access ?? audit;
  return <main className="journey-shell commerce-workspace" style={{ minWidth: 0, overflowWrap: "anywhere" }}><nav className="mock-links"><Link href="/admin">Support &amp; administration</Link><Link href="/admin/commerce">Packages &amp; grants</Link></nav><h1>Launch operations</h1>
    <div className="commerce-tabs" role="tablist" aria-label="Launch operations">{["overview", "access", "audit"].map(tab => <button key={tab} role="tab" aria-selected={view === tab} disabled={busy} onClick={() => { setData(null); setView(tab); setPage(1); }}>{tab === "overview" ? "Overview" : tab === "access" ? "Entitlements" : "Audit"}</button>)}<button title="Refresh" aria-label="Refresh operations" disabled={busy} onClick={() => setRefresh(n => n + 1)}><Icon name="arrow" /></button></div>
    {error && <p role="alert">{error}</p>}{!data && !error && <p role="status">Loading operations...</p>}
    {overview && <><section><h2>Operational queues</h2><p>As of {new Date(overview.asOf).toLocaleString()}</p><ul className="journey-task-list">{Object.entries(overview.counts).map(([name, count]) => { const [label, href] = labels[name as keyof Overview["counts"]]; return <li key={name}><Link href={href}>{label}</Link><strong>{count}</strong></li>; })}</ul></section>
      <section><h2>Launch controls</h2><p>Free invited pilot / payments, external messaging and live AI disabled</p><h3>Configuration flags</h3><ul>{overview.controls.approvalFlags.map(flag => <li key={flag.name}>{flag.name}: {flag.set ? "Set / evidence review still required" : "Not set"}</li>)}</ul><h3>External acceptance evidence</h3><ul>{overview.controls.externalEvidence.map(item => <li key={item.label}>{item.label}: not verified by the application</li>)}</ul></section></>}
    {view === "access" && <section><h2>Student entitlements</h2><form className="commerce-form" onSubmit={filter}><label>Student ID<input name="userId" maxLength={128} defaultValue={filters.userId} /></label><label>Window<select name="status" defaultValue={filters.status}>{["ALL", "CURRENT", "SCHEDULED", "EXPIRED", "REVOKED"].map(status => <option key={status}>{status}</option>)}</select></label><button disabled={busy}><Icon name="learnSearch" />Filter</button></form>
      {access && !access.entries.length && <p>No grants match.</p>}<ul className="journey-task-list">{access?.entries.map(grant => <li key={grant.id}><div><strong>{grant.featureCode} / {grant.status}</strong><p>Student {grant.userId} / {grant.source}</p><p>{new Date(grant.startsAt).toLocaleString()} to {new Date(grant.endsAt).toLocaleString()}</p><p>{grant.reason}</p><span>{grant.id}</span></div>{grant.status !== "REVOKED" && <form className="commerce-form" onSubmit={e => void revoke(e, grant.id)}><label>Withdrawal reason<input name="reason" minLength={8} maxLength={500} required disabled={busy} /></label><button disabled={busy}><Icon name="check" />Withdraw feature grant</button></form>}</li>)}</ul></section>}
    {view === "audit" && <section><h2>Operational audit</h2><form className="commerce-form" onSubmit={filter}><label>Entity<input name="entity" maxLength={80} pattern="[A-Za-z_]+" defaultValue={filters.entity} /></label><label>Action<input name="action" maxLength={80} pattern="[A-Z_]+" defaultValue={filters.action} /></label><button disabled={busy}><Icon name="learnSearch" />Filter</button></form>{audit && !audit.entries.length && <p>No audit events match.</p>}<ul className="journey-task-list">{audit?.entries.map(event => <li key={event.id}><div><strong>{event.action}</strong><p>{event.entity} / {event.entityId}</p><span>{new Date(event.at).toLocaleString()}</span></div></li>)}</ul></section>}
    {paged && <nav className="mock-links" aria-label="Operations pages"><button disabled={busy || page === 1} title="Previous page" aria-label="Previous page" onClick={() => setPage(n => n - 1)}>&larr;</button><span>Page {page}</span><button disabled={busy || !paged.hasNext || page === 1000} title="Next page" aria-label="Next page" onClick={() => setPage(n => n + 1)}>&rarr;</button></nav>}
  </main>;
}
