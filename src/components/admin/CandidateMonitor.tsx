"use client";
import { useEffect, useState } from "react";
import { studentRequest } from "@/components/journey/client";

type Candidate = { id: string; name: string; email: string; phone: string | null; status: string; joinedAt: string; ageBand: string; country: string; consentCurrent: boolean; onboarded: boolean; attempts: number; targets: { code: string; name: string; category: string; status: string; targetYear: number; preparationLevel: string; dailyMinutes: number }[] };
type Result = { total: number; page: number; pageSize: number; candidates: Candidate[] };

export function CandidateMonitor() {
  const [query, setQuery] = useState(""); const [result, setResult] = useState<Result>(); const [error, setError] = useState(""); const [busy, setBusy] = useState(true);
  useEffect(() => { let active = true; const timer = setTimeout(() => { setBusy(true); setError("");
    studentRequest<Result>(`/api/admin/candidates?q=${encodeURIComponent(query)}`).then((data) => { if (active) setResult(data); }).catch((e) => { if (active) setError(e instanceof Error ? e.message : "Candidate list unavailable"); }).finally(() => { if (active) setBusy(false); });
    }, 180); return () => { active = false; clearTimeout(timer); }; }, [query]);
  return <main className="admin-candidates"><div className="admin-candidates-heading"><div><span className="journey-kicker">CANDIDATE OPERATIONS</span><h1>Candidate monitor</h1><p>Review account setup, selected exam targets, consent status, and practice activity.</p></div><span className="admin-candidate-total">{result?.total ?? "—"}<small>candidates</small></span></div>
    <label className="admin-candidate-search">Search by name or email<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or email" /></label>
    {error ? <p role="alert" className="journey-error">{error}</p> : null}{busy && !result ? <p role="status">Loading candidates…</p> : null}
    {result && <div className="admin-candidate-table-wrap"><table className="admin-candidate-table"><thead><tr><th>Candidate</th><th>Account & consent</th><th>Exam targets</th><th>Activity</th></tr></thead><tbody>{result.candidates.map((candidate) => <tr key={candidate.id}><td><strong>{candidate.name}</strong><span>{candidate.email}</span><small>Joined {new Date(candidate.joinedAt).toLocaleDateString()}</small></td><td><span>{candidate.status} · {candidate.ageBand}</span><small>{candidate.country} · Consent {candidate.consentCurrent ? "current" : "needs attention"}</small><small>{candidate.onboarded ? "Plan set up" : "Onboarding incomplete"}</small></td><td>{candidate.targets.length ? candidate.targets.map((target) => <span className="admin-target-chip" key={`${target.code}-${target.targetYear}`}><strong>{target.name}</strong><small>{target.targetYear} · {target.preparationLevel.toLowerCase()} · {target.dailyMinutes}m/day</small></span>) : <small>No active exam targets</small>}</td><td><strong>{candidate.attempts}</strong><small>practice attempts</small></td></tr>)}</tbody></table>{!result.candidates.length && <p className="admin-candidate-empty">No matching candidates.</p>}</div>}
  </main>;
}
