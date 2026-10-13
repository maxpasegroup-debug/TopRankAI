"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { studentRequest, StudentRequestError } from "@/components/journey/client";
import { mockStorageKey, readMockDraft, mockSeconds, sameMockDraft, type RecoverableMockDraft } from "@/shared/mock-recovery";
import type { getMockAttempt, listStudentMocks, getMockRevision } from "@/server/mock/service";
type Attempt = Awaited<ReturnType<typeof getMockAttempt>>;
type Directory = Awaited<ReturnType<typeof listStudentMocks>>;
type Revision = Awaited<ReturnType<typeof getMockRevision>>;
type Draft = { answer: { optionIds?: string[]; numerical?: string }; flagged: boolean; bookmarked: boolean };
const api = "/api/student/mocks";
function formatTime(seconds: number) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }
export function MockDirectory({ mockId }: { mockId?: string }) {
 const [data, setData] = useState<Directory | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
 const keys = useRef(new Map<string, string>());
 const load = () => { setError(""); studentRequest<Directory>(api).then(setData).catch((e: Error) => setError(e.message)); };
 useEffect(load, []);
 async function start(id: string) { if (!data || busy) return; setBusy(true); setError("");
   const storage = `toprank.mock.start.${encodeURIComponent(data.ownerId)}.${encodeURIComponent(id)}`;
   let key = keys.current.get(id);
   try { const stored = sessionStorage.getItem(storage); if (stored && /^[a-f0-9-]{36}$/i.test(stored)) key ??= stored; } catch { /* In-memory retry remains available. */ }
   key ??= crypto.randomUUID(); keys.current.set(id, key);
   try { sessionStorage.setItem(storage, key); } catch { /* No persistent start recovery. */ }
   try { const a = await studentRequest<Attempt>(api, "POST", { action: "start", mockId: id, requestKey: key });
     try { sessionStorage.removeItem(storage); } catch { /* Browser storage can be unavailable. */ } keys.current.delete(id);
     window.location.assign(`/practice/mock-attempts?attemptId=${encodeURIComponent(a.id)}`);
   } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
 }
 const selected = data?.mocks.find((m) => m.id === mockId);
 return <div className="journey-shell"><span className="journey-kicker">PRACTICE</span><h1>{selected?.title ?? "Mock exams"}</h1>
   <nav className="mock-links"><Link href="/practice">Question bank</Link><Link href="/practice/revision">Revision</Link><Link href="/progress">My Progress</Link></nav>
   {error && <p className="journey-error" role="alert">{error} <button onClick={load}>Retry</button></p>}
   {!data && <p role="status">{error ? "Mock exams unavailable" : "Loading mock exams..."}</p>}
   {data && mockId && !selected && <p>This exam is no longer available. <Link href="/practice/mock-tests">All exams</Link></p>}
   {selected && <section><dl className="journey-metrics"><div><dt>Duration</dt><dd>{selected.durationSeconds / 60} min</dd></div><div><dt>Attempt limit</dt><dd>{selected.maxAttempts}</dd></div><div><dt>Review</dt><dd className="mock-small">{selected.revealPolicy === "NEVER" ? "Explanations withheld" : "After submission"}</dd></div></dl>
     <SectionTable sections={selected.sections} />
     <div className="journey-actions"><Link href="/practice/mock-tests">All exams</Link><button className="journey-primary" disabled={busy} onClick={() => start(selected.id)}>{busy ? "Opening..." : "Start / resume exam"}</button></div>
   </section>}
   {data && !mockId && <section><h2>Available exams</h2>{data.mocks.length ? <ul className="journey-task-list">{data.mocks.map((m) => <li key={m.id}><div><strong>{m.title}</strong><span>{m.durationSeconds / 60} minutes / {m.sections.reduce((n, s) => n + s.questionCount, 0)} questions</span></div><Link href={`/practice/mock-tests?mockId=${encodeURIComponent(m.id)}`}>Open exam</Link></li>)}</ul> : <p>No published mock exams for your target exam yet.</p>}</section>}
   {data && <section><h2>Attempt history</h2>{data.attempts.length ? <ul className="journey-task-list">{data.attempts.map((a) => <li key={a.id}><div><strong>{a.title}</strong><span>{a.status === "IN_PROGRESS" ? "In progress" : a.status === "EXPIRED" ? "Time expired" : "Submitted"}{a.result ? ` / ${a.result.score} / ${a.result.maximumScore}` : ""}</span></div><Link href={`/practice/mock-attempts?attemptId=${encodeURIComponent(a.id)}`}>{a.status === "IN_PROGRESS" ? "Resume" : "Results"}</Link></li>)}</ul> : <p>No attempts yet.</p>}</section>}
 </div>;
}
function SectionTable({ sections }: { sections: Directory["mocks"][number]["sections"] }) {
 return <div className="mock-table-scroll"><table className="mock-table"><thead><tr><th>Section</th><th>Questions</th><th>Correct</th><th>Incorrect</th><th>Unanswered</th></tr></thead><tbody>{sections.map((s, i) => <tr key={i}><th>{s.title}</th><td>{s.questionCount}</td><td>+{s.marks}</td><td>-{s.negativeMarks}</td><td>{s.unansweredMarks}</td></tr>)}</tbody></table></div>;
}
function SubmitConfirmation({ busy, cancel, submit }: { busy: boolean; cancel: () => void; submit: () => void }) {
 const dialog = useRef<HTMLDialogElement>(null);
 useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
 return <dialog ref={dialog} onCancel={(e) => { if (busy) e.preventDefault(); else cancel(); }} aria-labelledby="submit-heading" className="mock-confirm">
   <h2 id="submit-heading">Submit this exam?</h2><p>Answers cannot be changed after submission.</p>
   <div className="journey-actions"><button autoFocus disabled={busy} onClick={cancel}>Keep working</button><button disabled={busy} className="journey-primary" onClick={submit}>Confirm submission</button></div>
 </dialog>;
}
export function MockWorkspace({ attemptId }: { attemptId: string }) {
 const [data, setData] = useState<Attempt | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
 const [index, setIndex] = useState(0), [seconds, setSeconds] = useState(0), [confirm, setConfirm] = useState(false);
 const [draft, setDraftState] = useState<Draft>({ answer: {}, flagged: false, bookmarked: false });
 const [notice, setNotice] = useState(""), [autoPaused, setAutoPaused] = useState(false);
 const pending = useRef<RecoverableMockDraft | null>(null);
 const anchor = useRef({ remaining: 0, tick: 0, wall: 0 }), inFlight = useRef(false), nextExpiryTry = useRef(0), nextSaveTry = useRef(0);
 const refreshRef = useRef<() => Promise<void>>(async () => {}), saveRef = useRef<() => Promise<boolean>>(async () => false);
 const apply = (a: Attempt) => { anchor.current = { remaining: Math.max(0, new Date(a.deadline).getTime() - new Date(a.serverNow).getTime()), tick: performance.now(), wall: Date.now() }; setSeconds(mockSeconds(anchor.current, performance.now(), Date.now())); setData(a); };
 function clearLocal(ownerId: string) { pending.current = null; try { sessionStorage.removeItem(mockStorageKey(ownerId, attemptId)); } catch { /* No storage access. */ } }
 async function load(discard = false) {
   if (inFlight.current) return; inFlight.current = true; setBusy(true); setError("");
   try { const a = await studentRequest<Attempt>(`${api}?attemptId=${encodeURIComponent(attemptId)}`);
     if (discard) { clearLocal(a.ownerId); setNotice(""); }
     let local = pending.current;
     try { local ??= readMockDraft(sessionStorage.getItem(mockStorageKey(a.ownerId, attemptId))); } catch { /* Retain the in-memory draft. */ }
     if (local && !a.questions[local.position]) { clearLocal(a.ownerId); local = null; }
     const position = local?.position ?? index;
     const server = a.answers.find(answer => answer.position === position);
     if (local && server && sameMockDraft(local, server)) { clearLocal(a.ownerId); local = null; }
     pending.current = local; setIndex(position); apply(a);
     if (local) { setDraftState(local); if (a.status !== "IN_PROGRESS") setNotice("Unconfirmed local edits were not included in this finalized result."); }
     else if (server) setDraftState({ answer: server.answer, flagged: server.flagged, bookmarked: server.bookmarked });
     setAutoPaused(Boolean(local && server && local.version !== server.version));
     if (local && server && local.version !== server.version && a.status === "IN_PROGRESS") setError("Another tab changed this answer. Your local draft is preserved; compare it before discarding or retrying.");
   } catch (e) { setError((e as Error).message); } finally { inFlight.current = false; setBusy(false); }
 }
 refreshRef.current = load;
 useEffect(() => { void load(); }, [attemptId]); // eslint-disable-line react-hooks/exhaustive-deps
 const saved = data?.answers.find((a) => a.position === index);
 useEffect(() => { if (pending.current?.position === index) setDraftState(pending.current); else if (saved) setDraftState({ answer: saved.answer, flagged: saved.flagged, bookmarked: saved.bookmarked }); }, [index, saved?.version]);
 const dirty = Boolean(saved && !sameMockDraft(saved, draft));
 function setDraft(value: Draft) {
   setDraftState(value); setAutoPaused(false); setError(""); nextSaveTry.current = 0;
   if (!data || !saved) return;
   const local = { position: index, version: pending.current?.position === index ? pending.current.version : saved.version, ...value };
   pending.current = local;
   try { sessionStorage.setItem(mockStorageKey(data.ownerId, attemptId), JSON.stringify({ savedAt: Date.now(), draft: local })); }
   catch { setNotice("Local recovery storage is unavailable. Keep this tab open until your answer is saved."); }
 }
 useEffect(() => {
   const warn = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
   window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
 }, [dirty]);
 async function submit() {
   if (inFlight.current) return; inFlight.current = true; setBusy(true); setError("");
   try { apply(await studentRequest<Attempt>(api, "POST", { action: "submit", attemptId })); setConfirm(false); }
   catch (e) { setError((e as Error).message); } finally { inFlight.current = false; setBusy(false); }
 }
 useEffect(() => {
   if (data?.status !== "IN_PROGRESS") return;
   const timer = window.setInterval(() => { const remaining = mockSeconds(anchor.current, performance.now(), Date.now()); setSeconds(remaining);
     if (!remaining && performance.now() >= nextExpiryTry.current) { nextExpiryTry.current = performance.now() + 5000; void refreshRef.current(); }
   }, 250); return () => clearInterval(timer);
 }, [data?.status, attemptId]); // eslint-disable-line react-hooks/exhaustive-deps
 async function save(): Promise<boolean> {
   if (!data || !saved) return false;
   if (!dirty) { clearLocal(data.ownerId); return data.status === "IN_PROGRESS"; }
   if (inFlight.current) return false; inFlight.current = true; setBusy(true); setError("");
   try { const payload = pending.current ?? { position: index, version: saved.version, ...draft };
     const a = await studentRequest<Attempt>(api, "POST", { action: "save", attemptId, ...payload });
     const acknowledged = a.answers.find(answer => answer.position === payload.position);
     if (acknowledged && sameMockDraft(payload, acknowledged)) { clearLocal(a.ownerId); setNotice(""); }
     else { setAutoPaused(true); setNotice("Unconfirmed local edits were not saved. The server result remains authoritative."); }
     apply(a); return a.status === "IN_PROGRESS" && Boolean(acknowledged && sameMockDraft(payload, acknowledged));
   } catch (e) { setError((e as Error).message); nextSaveTry.current = Date.now() + 10000;
     if (e instanceof StudentRequestError && [400, 409, 413, 415].includes(e.status)) setAutoPaused(true);
     return false;
   } finally { setBusy(false); inFlight.current = false; }
 }
 saveRef.current = save;
 useEffect(() => {
   if (!dirty || busy || autoPaused || data?.status !== "IN_PROGRESS" || !navigator.onLine) return;
   const timer = window.setTimeout(() => { void saveRef.current(); }, Math.max(750, nextSaveTry.current - Date.now()));
   return () => clearTimeout(timer);
 }, [dirty, draft, busy, autoPaused, data?.status]);
 useEffect(() => {
   const online = () => { nextSaveTry.current = 0; void refreshRef.current(); };
   const visible = () => { if (document.visibilityState === "visible") void refreshRef.current(); };
   window.addEventListener("online", online); window.addEventListener("pageshow", online); document.addEventListener("visibilitychange", visible);
   return () => { window.removeEventListener("online", online); window.removeEventListener("pageshow", online); document.removeEventListener("visibilitychange", visible); };
 }, [attemptId]);
 async function navigate(next: number) { if (await save()) setIndex(next); }
 const q = data?.questions[index];
 const answerLabel = (answer: Draft["answer"], position = index) => answer.numerical ?? answer.optionIds?.map(id => data?.questions[position]?.options.find(o => o.id === id)?.text ?? "Option unavailable").join(", ") ?? "Unanswered";
 return <div className="journey-shell"><nav className="mock-links"><Link href="/practice/mock-tests">Mock exams</Link><Link href="/practice/revision">Revision</Link></nav><h1>{data?.title ?? "Mock exam"}</h1>
   {error && <p role="alert" className="journey-error">{error}<button disabled={busy} onClick={() => void load()}>Reconnect / compare saved attempt</button><button disabled={busy} onClick={() => { if (!dirty || window.confirm("Discard your local draft and reload the saved answer?")) void load(true); }}>Discard local draft and reload</button></p>}
   {notice && <p role="status">{notice}</p>}
   {autoPaused && pending.current && saved && data?.status === "IN_PROGRESS" && <section><h2>Compare answers</h2><p>Saved: {answerLabel(saved.answer)}</p><p>Local draft: {answerLabel(pending.current.answer)}</p></section>}
   {!data ? <p role="status">{error ? "Attempt unavailable" : "Loading attempt..."}</p> : data.status !== "IN_PROGRESS" ? <>
     <p role="status">{data.status === "EXPIRED" ? "Time expired. Saved answers were finalized." : "Exam submitted."}</p>
     {pending.current && <section><h2>Unconfirmed local answer</h2><p>Question {pending.current.position + 1}: {answerLabel(pending.current.answer, pending.current.position)}</p><button disabled={busy} onClick={() => { if (window.confirm("Discard this unconfirmed local answer?")) void load(true); }}>Discard local draft</button></section>}
     {data.result && <><dl className="journey-metrics"><div><dt>Score</dt><dd>{data.result.score} / {data.result.maximumScore}</dd></div><div><dt>Accuracy (answered)</dt><dd>{data.result.accuracy}%</dd></div><div><dt>Time taken</dt><dd>{formatTime(data.result.timeSeconds)}</dd></div></dl>
       <p>{data.result.answered} answered / {data.result.total - data.result.answered} unanswered / {data.result.correct} correct</p>
       <div className="mock-table-scroll"><table className="mock-table"><thead><tr><th>Section</th><th>Score</th><th>Answered</th><th>Correct</th></tr></thead><tbody>{data.result.sections.map((s, i) => <tr key={i}><th>{s.title}</th><td>{s.score} / {s.maximumScore}</td><td>{s.answered} / {s.total}</td><td>{s.correct}</td></tr>)}</tbody></table></div>
     </>}
     {data.review.length > 0 && <details><summary>Question results and explanations</summary><ol>{data.review.map(r => <li key={r.position}><h2 className="mock-question-text">{data.questions[r.position].text}</h2><p>{r.answered ? r.correct ? "Correct" : "Incorrect" : "Unanswered"} / {r.score} marks</p>{r.explanation ? <p>{r.explanation}</p> : <p>No explanation was recorded in this attempt.</p>}</li>)}</ol></details>}
     <div className="journey-actions"><Link href="/practice/revision">Review questions</Link><Link href="/compete">Competition rankings</Link><Link href="/achievements">Check earned achievements</Link><Link href="/home">Mission & study session</Link><Link href="/progress">Digital Profile</Link></div>
   </> : q && <>
     <div className="mock-toolbar"><strong>{data.sections[q.section].title}</strong><output aria-label="Time remaining">{formatTime(seconds)}</output><span role="status">{busy ? "Saving..." : dirty ? "Unsaved changes" : "Saved"}</span></div>
     <p>{data.answers.filter((a) => a.answer.optionIds?.length || a.answer.numerical !== undefined).length} answered / {data.answers.filter((a) => !a.answer.optionIds?.length && a.answer.numerical === undefined).length} unanswered / {data.answers.filter((a) => a.flagged).length} flagged</p>
     <div className="mock-question-layout"><nav className="mock-palette" aria-label="Questions">{data.questions.map((question, i) => { const a = data.answers[i]; const answered = Boolean(a?.answer.optionIds?.length || a?.answer.numerical !== undefined);
       return <button key={i} disabled={busy} aria-current={i === index ? "step" : undefined} title={`Question ${i + 1}: ${answered ? "answered" : "unanswered"}${a?.flagged ? ", flagged" : ""}`} className={`${answered ? "answered" : ""} ${a?.flagged ? "flagged" : ""}`} onClick={() => navigate(question.position)}>{i + 1}{a?.flagged ? "*" : ""}</button>; })}</nav>
       <section><p>Question {index + 1} of {data.questions.length} / +{q.marks} / -{q.negativeMarks}</p><h2 className="mock-question-text">{q.text}</h2>
         <fieldset className="journey-answer-options" disabled={busy || seconds === 0}><legend className="sr-only">Answer</legend>
           {q.type === "NUMERICAL" ? <label className="journey-field">Numerical answer<input value={draft.answer.numerical ?? ""} inputMode="decimal" maxLength={60} onChange={(e) => setDraft({ ...draft, answer: e.target.value ? { numerical: e.target.value } : {} })} /></label> : q.options.map((o) => <label key={o.id}><input type={q.type === "SINGLE_CHOICE" ? "radio" : "checkbox"} name="mock-answer" checked={draft.answer.optionIds?.includes(o.id) ?? false} onChange={(e) => { const ids = q.type === "SINGLE_CHOICE" ? [o.id] : e.target.checked ? [...(draft.answer.optionIds ?? []), o.id] : (draft.answer.optionIds ?? []).filter((id) => id !== o.id); setDraft({ ...draft, answer: ids.length ? { optionIds: ids.sort() } : {} }); }} />{o.text}</label>)}
         </fieldset>
         <div className="mock-links"><label><input type="checkbox" disabled={busy} checked={draft.flagged} onChange={(e) => setDraft({ ...draft, flagged: e.target.checked })} /> Flag for review</label><label><input type="checkbox" disabled={busy} checked={draft.bookmarked} onChange={(e) => setDraft({ ...draft, bookmarked: e.target.checked })} /> Bookmark</label></div>
         <div className="journey-actions"><button title="Clear answer" disabled={busy} onClick={() => setDraft({ ...draft, answer: {} })}>Clear</button><button disabled={busy || index === 0} onClick={() => navigate(index - 1)}>Previous</button><button disabled={busy || !dirty} onClick={() => save()}>Save answer</button><button disabled={busy || index === data.questions.length - 1} onClick={() => navigate(index + 1)}>Next</button></div>
       </section></div>
     <div className="journey-actions"><button className="journey-primary" disabled={busy} onClick={() => setConfirm(true)}>Submit exam</button></div>
     {confirm && <SubmitConfirmation busy={busy} cancel={() => setConfirm(false)} submit={async () => { if (await save()) await submit(); }} />}
   </>}
 </div>;
}
export function MockRevision() {
 const [entries, setEntries] = useState<Revision | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false), [filter, setFilter] = useState("Pending");
 const load = () => { studentRequest<Revision>(`${api}/revision`).then(setEntries).catch((e: Error) => setError(e.message)); };
 useEffect(load, []);
 async function action(entry: Revision[number], action: string) { setBusy(true); setError(""); try {
   await studentRequest(`${api}/revision`, "POST", { attemptId: entry.attemptId, position: entry.position, action, ...(action === "bookmark" ? { bookmarked: !entry.bookmarked } : {}) }); load();
 } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
 const shown = entries?.filter((e) => filter === "All" || (filter === "Pending" ? !e.reviewedAt : e.reasons.includes(filter)));
 return <div className="journey-shell"><span className="journey-kicker">OBSERVED PERFORMANCE</span><h1>Revision</h1><nav className="mock-links"><Link href="/practice/mock-tests">Mock exams</Link><Link href="/home">Mission & study session</Link></nav>
   {error && <p role="alert" className="journey-error">{error}<button onClick={load}>Retry</button></p>}
   <label className="journey-field mock-filter">Review queue<select value={filter} onChange={(e) => setFilter(e.target.value)}>{["Pending", "Incorrect", "Unanswered", "Flagged", "Bookmarked", "All"].map((f) => <option key={f}>{f}</option>)}</select></label>
   {!entries ? <p role="status">{error ? "Revision unavailable" : "Loading revision..."}</p> : !shown?.length ? <p>No questions in this review queue.</p> : <ul className="mock-revision-list">{shown.map((entry) => <li key={`${entry.attemptId}-${entry.position}`}><p>{entry.title} / Question {entry.position + 1} / {entry.reasons.join(", ")}{entry.reviewedAt ? " / Reviewed" : ""}</p><h2 className="mock-question-text">{entry.text}</h2>
     <p>Your answer: {entry.answer.numerical ?? entry.answer.optionIds?.map((id) => entry.options.find((o) => o.id === id)?.text ?? "Option unavailable").join(", ") ?? "Unanswered"}</p>
     {entry.explanation && <p className="mock-explanation">{entry.explanation}</p>}
     <div className="mock-links">{entry.lessonHref && <Link href={entry.lessonHref}>Review lesson</Link>}<Link href={`/practice/mock-attempts?attemptId=${encodeURIComponent(entry.attemptId)}`}>Result</Link><button disabled={busy || Boolean(entry.reviewedAt)} onClick={() => action(entry, "reviewed")}>Mark reviewed</button><button disabled={busy} onClick={() => action(entry, "bookmark")}>{entry.bookmarked ? "Remove bookmark" : "Bookmark"}</button><button disabled={busy || Boolean(entry.revisionTaskId)} onClick={() => action(entry, "mission")}>{entry.revisionTaskId ? "Added to mission" : "Add 15-minute revision"}</button></div>
   </li>)}</ul>}
 </div>;
}
export function MockProgress() {
 const [data, setData] = useState<Directory | null>(null), [error, setError] = useState("");
 useEffect(() => { studentRequest<Directory>(api).then(setData).catch((e: Error) => setError(e.message)); }, []);
 return <section><h2>Mock performance</h2>{error && <p role="status">{error}</p>}{data && <><p>{data.attempts.filter((a) => a.result).length} finalized attempts (latest 50).</p><ul className="journey-task-list">{data.attempts.filter((a) => a.result).slice(0, 5).map((a) => <li key={a.id}><div><strong>{a.title}</strong><span>{a.result!.score} / {a.result!.maximumScore} - {a.result!.accuracy}% accuracy - {formatTime(a.result!.timeSeconds)}</span></div><Link href={`/practice/mock-attempts?attemptId=${encodeURIComponent(a.id)}`}>Result</Link></li>)}</ul></>}<div className="mock-links"><Link href="/practice/mock-tests">Exam history</Link><Link href="/practice/revision">Revision queue</Link></div></section>;
}
