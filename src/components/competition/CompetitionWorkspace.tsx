"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { studentRequest } from "@/components/journey/client";
import type { competitionDirectory, competitionLeaderboard, overallLeaderboard } from "@/server/competition/service";
import type { getAchievements } from "@/server/competition/achievements";
import { Icon } from "@/components/ui/Icon";
type Directory = Awaited<ReturnType<typeof competitionDirectory>>;
type Board = Awaited<ReturnType<typeof competitionLeaderboard>>;
type Overall = Awaited<ReturnType<typeof overallLeaderboard>>;
type Achievements = Awaited<ReturnType<typeof getAchievements>>;
const api = "/api/student/competitions";
export function CompetitionWorkspace({ id }: { id?: string }) {
 const [data, setData] = useState<Directory | null>(null), [board, setBoard] = useState<Board | null>(null), [overall, setOverall] = useState<Overall | null>(null);
 const [page, setPage] = useState(1), [overallPage, setOverallPage] = useState(1), [error, setError] = useState(""), [busy, setBusy] = useState(false);
 const requestKeys = useRef(new Map<string, string>());
 async function load() { setError(""); try { setData(await studentRequest<Directory>(api));
   if (id) setBoard(await studentRequest<Board>(`${api}?id=${encodeURIComponent(id)}&page=${page}`));
   else setOverall(await studentRequest<Overall>(`${api}?overall=true&page=${overallPage}`));
 } catch (e) { setError((e as Error).message); } }
 useEffect(() => { void load(); }, [id, page, overallPage]); // eslint-disable-line react-hooks/exhaustive-deps
 async function act(action: string, extra = {}) { if (!id) return; setBusy(true); setError(""); try {
   const requestKey = requestKeys.current.get(id) ?? crypto.randomUUID(); requestKeys.current.set(id, requestKey); const response = await studentRequest<{ attemptId?: string }>(api, "POST", { action, id, ...(action === "join" ? { requestKey } : {}), ...extra });
   if (response.attemptId) window.location.assign(`/practice/mock-attempts?attemptId=${encodeURIComponent(response.attemptId)}`); else await load();
 } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
 return <div className="journey-shell"><span className="journey-kicker">TOPRANK</span><h1>{board?.competition.title ?? "Compete"}</h1>
   <nav className="mock-links"><Link href="/compete">Challenges</Link><Link href="/achievements">Achievements & prizes</Link><Link href="/practice/mock-tests">Mock practice</Link><Link href="/home">Mission & study session</Link></nav>
   {error && <p role="alert" className="journey-error">{error}<button onClick={load}>Retry</button></p>}
   {!data && <p role="status">{error ? "Competitions unavailable" : "Loading challenges..."}</p>}
   {data && !id && <section><h2>Weekly & monthly challenges</h2>{data.competitions.length ? <ul className="journey-task-list">{data.competitions.map((c) => <li key={c.id}><div><strong>{c.title}</strong><span>{c.type} / {c.phase} / closes {new Date(c.endsAt).toLocaleString()}</span></div><Link href={`/compete?id=${encodeURIComponent(c.id)}`}>Details & leaderboard</Link></li>)}</ul> : <p>No published challenges for your target exam.</p>}</section>}
   {board && <>
     <dl className="journey-metrics"><div><dt>Status</dt><dd className="mock-small">{board.competition.phase}</dd></div><div><dt>Duration</dt><dd>{board.competition.durationSeconds / 60} min</dd></div><div><dt>Your rank</dt><dd>{board.mine?.rank ?? "Not ranked"}</dd></div></dl>
     <p>Starts {new Date(board.competition.startsAt).toLocaleString()} / entry closes {new Date(board.competition.endsAt).toLocaleString()}.</p>
     <p role="status">Rankings: {board.competition.rankingState === "VERIFIED" ? "Verified final results" : board.competition.rankingState === "CANCELLED" ? "Cancelled / rankings withdrawn" : "Provisional / not yet verified final results"}{board.competition.resultsVerifiedAt ? ` / ${new Date(board.competition.resultsVerifiedAt).toLocaleString()}` : ""}</p>
     <p>Already-started attempts may finish by {new Date(board.competition.finishBy).toLocaleString()}. One entry per student. Capacity {board.competition.config.capacity}. Requires {board.competition.config.minCompletedMocks} completed mock attempts.</p>
     <p>Ranking: {board.competition.config.scoring === "RAW_SCORE" ? "score" : "percentage score"}, then shorter elapsed time and earlier participation. Exact ties share a placement.</p>
     {board.mine?.disqualified ? <p role="status">Your entry is disqualified. Contact support for a review.</p> : <div className="mock-links">{board.mine?.attemptId ? <Link href={`/practice/mock-attempts?attemptId=${encodeURIComponent(board.mine.attemptId)}`}>Open your attempt</Link> : board.competition.phase === "ACTIVE" && <button disabled={busy} className="journey-primary" onClick={() => act("join")}>Join challenge</button>}{board.mine && <><button disabled={busy || board.competition.rankingState === "CANCELLED"} onClick={() => act("sync")}>Refresh rankings</button><label><input type="checkbox" disabled={busy} checked={board.mine.visible} onChange={(e) => act("visibility", { visible: e.target.checked })} /> Show my generated alias and competition score</label></>}</div>}
     {board.mine?.score && <p>{board.competition.rankingState === "VERIFIED" ? "Your verified score:" : "Your provisional score:"} {board.mine.score}</p>}
     <h2>Competition leaderboard</h2>{board.rows.length ? <div className="mock-table-scroll"><table className="mock-table"><thead><tr><th>Rank</th><th>Participant</th><th>Score</th><th>Seconds</th></tr></thead><tbody>{board.rows.map((r, i) => <tr key={`${r.rank}-${i}`}><td>{r.rank}</td><td>{r.name}</td><td>{r.score ?? "Private"}</td><td>{r.timeSeconds ?? "Private"}</td></tr>)}</tbody></table></div> : <p>No ranked results yet. Started or unprocessed attempts may still be pending.</p>}
     <Pagination page={page} hasNext={board.hasNext} change={setPage} />
   </>}
   {overall && <section><h2>Overall opt-in placement points</h2>{overall.rows.length ? <ol className="journey-task-list" start={(overall.page - 1) * 25 + 1}>{overall.rows.map((r, i) => <li key={`${r.rank}-${i}`}><strong>{r.rank}. {r.name}</strong><span>{r.points} points</span></li>)}</ol> : <p>No opted-in completed placements yet.</p>}<Pagination page={overallPage} hasNext={overall.hasNext} change={setOverallPage} /></section>}
 </div>;
}
function Pagination({ page, hasNext, change }: { page: number; hasNext: boolean; change: (page: number) => void }) {
 return <nav className="mock-links" aria-label="Leaderboard pages"><button title="Previous page" aria-label="Previous page" disabled={page === 1} onClick={() => change(page - 1)}>&larr;</button><span>Page {page}</span><button title="Next page" aria-label="Next page" disabled={!hasNext} onClick={() => change(page + 1)}>&rarr;</button></nav>;
}
export function AchievementHistory({ compact = false }: { compact?: boolean }) {
 const [data, setData] = useState<Achievements | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false), [share, setShare] = useState<{ id: string; href: string } | null>(null), [message, setMessage] = useState("");
 async function load() { try { setData(await studentRequest<Achievements>("/api/student/achievements")); } catch (e) { setError((e as Error).message); } }
 useEffect(() => { void load(); }, []);
 async function act(payload: unknown) { setBusy(true); setError(""); try { const response = await studentRequest<{ href?: string | null; qualified?: number }>("/api/student/achievements", "POST", payload);
   if (response.href) setShare({ id: (payload as { id: string }).id, href: response.href }); else setShare(null);
   if (response.qualified !== undefined) setMessage(`Eligibility check complete: ${response.qualified} definitions matched saved activity.`); await load();
 } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
 return <section className={compact ? undefined : "journey-shell"}>{!compact && <><h1>Achievements & prizes</h1><nav className="mock-links"><Link href="/compete">Compete</Link><Link href="/progress">Digital Profile</Link></nav></>}{compact && <h2>Earned achievements</h2>}
   {error && <p className="journey-error" role="alert">{error}<button onClick={load}>Retry</button></p>}{message && <p role="status">{message}</p>}
   <div className="mock-links"><button disabled={busy} onClick={() => act({ action: "check" })}>Check earned badges</button>{compact && <Link href="/achievements">All achievements & prizes</Link>}</div>
   {!data ? <p role="status">{error ? "Achievements unavailable" : "Loading earned achievements..."}</p> : !data.length ? <p>No earned achievements yet.</p> : <ul className="competition-achievements">{(compact ? data.slice(0, 3) : data).map((a) => <li key={a.id}><span className="competition-badge" aria-hidden="true"><Icon name={a.badge as "compete"} /></span><div><h3>{a.title}</h3><p>{a.explanation}</p><p>{a.status} / {new Date(a.awardedAt).toLocaleDateString()}</p>{a.prize && <p>Prize: {a.prize.label} / {a.prize.status === "FULFILLED" ? "Manual fulfilment recorded" : a.prize.status}</p>}
     {!compact && Boolean(a.history.length) && <details><summary>Award history</summary><ul>{a.history.map((event, i) => <li key={i}>{event.action} / {new Date(event.at).toLocaleString()}</li>)}</ul></details>}
     {a.status === "ACTIVE" && <div className="mock-links"><button disabled={busy} onClick={() => act({ action: "share", id: a.id, enabled: true })}>{a.sharing ? "Replace share link" : "Enable sharing"}</button>{a.sharing && <button disabled={busy} onClick={() => act({ action: "share", id: a.id, enabled: false })}>Disable sharing</button>}</div>}
     {share?.id === a.id && <div className="mock-links"><Link href={share.href}>Open shared achievement</Link><button onClick={() => navigator.clipboard.writeText(`${window.location.origin}${share.href}`).then(() => setMessage("Share link copied.")).catch(() => setError("Clipboard unavailable."))}>Copy share link</button></div>}
   </div></li>)}</ul>}
 </section>;
}
