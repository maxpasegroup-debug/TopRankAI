"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { studentRequest } from "./client";
import { calendarDay, shiftDay } from "@/shared/study-calendar";
import styles from "./MissionBoard.module.css";

type Task = { id: string; title: string; subject: string; href: string | null; dueDate: string; minutes: number;
  status: "TODO" | "COMPLETED" | "SKIPPED"; version: number };
type Plan = { id: string; title: string; tasks: Task[]; dailyMinutes: number };
type Session = { id: string; topic: string; startedAt: string; endedAt: string | null };
type Overview = { today: string; start: string; dailyBudget: number | null; plan: Plan | null; overdue: Task[]; sessionsTruncated: boolean; taskListPossiblyTruncated: boolean;
  days: { date: string; plannedMinutes: number; completed: number; recordedMinutes: number }[]; sessions: Session[] };
type Choice = { kind: "LESSON" | "PRACTICE"; resourceId: string; title: string };
type Draft = { previewToken: string; tasks: { title: string; subject: string; dueDate: string; minutes: number }[] };
export function MissionBoard({ name }: { name?: string }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [topic, setTopic] = useState("");
  const [sessionKey, setSessionKey] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata"); const [week, setWeek] = useState(""); const [view, setView] = useState("Today");
  const [overview, setOverview] = useState<Overview | null>(null); const [choices, setChoices] = useState<Choice[]>([]); const [draft, setDraft] = useState<Draft | null>(null);
  const [selectedTask, setSelectedTask] = useState(""); const [seconds, setSeconds] = useState(0);
  const [day, setDay] = useState(""); const [draftKey, setDraftKey] = useState(""); const [taskKey, setTaskKey] = useState("");
  const query = `timezone=${encodeURIComponent(timezone)}${week ? `&start=${week}` : ""}`;
  async function load() { const [data, current, options] = await Promise.all([studentRequest<Overview>(`/api/student/command-centre?${query}`), studentRequest<Session | null>("/api/student/study-sessions"), studentRequest<Choice[]>("/api/student/command-centre/choices")]); setOverview(data); setPlan(data.plan); setSession(current); setChoices(options); }
  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setDraft(null);
    Promise.all([studentRequest<Overview>(`/api/student/command-centre?${query}`), studentRequest<Session | null>("/api/student/study-sessions"), studentRequest<Choice[]>("/api/student/command-centre/choices")])
      .then(([data, current, options]) => { if (active) { setPlan(data.plan); setOverview(data); setSession(current); setChoices(options); } })
      .catch((e: Error) => active && setError(e.message)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [query]);
  useEffect(() => { function tick() { setSeconds(session ? Math.max(0, Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000)) : 0); } tick(); const id = window.setInterval(tick, 1000); return () => window.clearInterval(id); }, [session]);
  async function change(task: Task, values: object) {
    setBusy(true); setError("");
    try { await studentRequest("/api/student/missions", "PATCH", { id: task.id, version: task.version, timezone, ...values }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to save"); }
    finally { setBusy(false); }
  }
  function editMinutes(task: Task, field: HTMLInputElement) {
    const minutes = Number(field.value);
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 120) { field.value = String(task.minutes); setError("Choose whole minutes between 5 and 120"); return; }
    if (minutes !== task.minutes) void change(task, { minutes });
  }
  async function timer() {
    setBusy(true); setError("");
    const key = sessionKey || crypto.randomUUID(); setSessionKey(key);
    try {
      const result = await studentRequest<Session>("/api/student/study-sessions", "POST", session ? { action: "stop", id: session.id } : { action: "start", requestKey: key, topic, ...(selectedTask ? { taskId: selectedTask } : {}) });
      setSession(result.endedAt ? null : result); if (result.endedAt) { setSessionKey(""); await load(); }
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save"); } finally { setBusy(false); }
  }
  const completed = plan?.tasks.filter((task) => task.status === "COMPLETED").length ?? 0;
  const today = overview?.today ?? calendarDay(new Date(), timezone);
  const visible = plan?.tasks.filter(task => view === "Today" ? task.dueDate.slice(0, 10) === today : view === "Day" ? task.dueDate.slice(0, 10) === day : view === "Overdue" ? task.status === "TODO" && task.dueDate.slice(0, 10) < today : task.dueDate.slice(0, 10) >= (week || today) && task.dueDate.slice(0, 10) <= shiftDay(week || today, 6)) ?? [];
  async function weeklyPreview() { setBusy(true); setError(""); setDraft(null); try { setDraft(await studentRequest<Draft>(`/api/student/missions/preview?startDate=${week || today}`)); setDraftKey(crypto.randomUUID()); } catch (e) { setError(e instanceof Error ? e.message : "Preview unavailable"); } finally { setBusy(false); } }
  async function confirmWeek() { if (!draft) return; setBusy(true); setError(""); try { await studentRequest("/api/student/missions", "POST", { requestKey: draftKey, title: "My weekly study plan", previewToken: draft.previewToken, startDate: week || today }); setDraft(null); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Unable to confirm plan"); } finally { setBusy(false); } }
  async function addTask(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const choice = choices[Number(form.get("choice"))]; if (!choice) return; setBusy(true); setError(""); const key = taskKey || crypto.randomUUID(); setTaskKey(key); try { await studentRequest("/api/student/command-centre", "POST", { requestKey: key, kind: choice.kind, resourceId: choice.resourceId, dueDate: form.get("dueDate"), minutes: Number(form.get("minutes")), timezone }); setTaskKey(""); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Unable to plan task"); } finally { setBusy(false); } }
  return <main className="journey-shell">
    <div className="journey-heading"><span className="journey-kicker">MISSION CONTROL</span><Link href="/onboarding">Edit goals</Link></div>
    <h1>{name ? `${name}'s mission board` : "Your mission board"}</h1>
    <nav className="journey-actions"><Link href="/learn/catalogue">Learning</Link><Link href="/practice">Practice</Link><Link href="/practice/revision">Revision</Link><Link href="/progress">Progress</Link></nav>
    <div className={styles.controls}><label className="journey-field">Timezone<select value={timezone} disabled={busy} onChange={e => { setTimezone(e.target.value); setWeek(""); }}>{["Asia/Kolkata", "Asia/Dubai", "UTC"].map(value => <option key={value}>{value}</option>)}</select></label><label className="journey-field">Week starting<input type="date" value={week || today} disabled={busy} onChange={e => setWeek(e.target.value)} /></label><button disabled={busy || loading || (week || today) < today} onClick={() => void weeklyPreview()}>Review new weekly plan</button></div>
    {draft && <section><h2>Weekly plan preview</h2><p role="alert">Confirmation replaces the active plan. Previous work stays in your progress history; unfinished missions are not carried forward.</p><ul>{draft.tasks.map((task, index) => <li key={index}>{task.dueDate.slice(0, 10)} / {task.title} / {task.minutes} min</li>)}</ul><button disabled={busy} onClick={() => void confirmWeek()}>Confirm weekly plan</button><button disabled={busy} onClick={() => setDraft(null)}>Cancel</button></section>}
    {error && <p className="journey-error" role="alert">{error}<button onClick={() => void load().then(() => setError("")).catch((e: Error) => setError(e.message))}>Retry</button></p>}
    {loading ? <p role="status">Loading missions...</p> : !plan ? <section><h2>No mission plan yet</h2><Link href="/onboarding">Create a mission</Link></section> : <>
      <div className="journey-heading"><h2>{plan.title}</h2><span>{completed} / {plan.tasks.length} completed</span></div>
      <progress aria-label="Mission completion" value={completed} max={Math.max(1, plan.tasks.length)} />
      <div className={styles.week}>{overview?.days.map(entry => <button key={entry.date} type="button" aria-pressed={view === "Day" && day === entry.date} onClick={() => { setDay(entry.date); setView("Day"); }}><strong>{entry.date}</strong><span>{entry.plannedMinutes} / {plan.dailyMinutes} min planned</span><span>{entry.recordedMinutes} min recorded</span>{entry.plannedMinutes > plan.dailyMinutes && <span>Over budget</span>}</button>)}</div>
      <div className="journey-actions" role="group" aria-label="Mission view">{["Today", "Week", "Overdue"].map(value => <button key={value} aria-pressed={view === value} onClick={() => setView(value)}>{value}{value === "Overdue" ? ` (${overview?.overdue.length ?? 0})` : ""}</button>)}</div>
      {overview?.taskListPossiblyTruncated && <p role="alert">Mission list may be incomplete at the 500-task limit.</p>}
      {!visible.length && <p>No missions in this view.</p>}
      <ul className="journey-task-list">{visible.map((task) => <li key={task.id}>
        <label className="journey-check"><input type="checkbox" disabled={busy} checked={task.status === "COMPLETED"} onChange={(e) => void change(task, { status: e.target.checked ? "COMPLETED" : "TODO" })} /><div><strong>{task.title}</strong><span>{task.subject} / {task.minutes} min</span></div></label>
        <div className="journey-task-actions"><span>{task.status}{task.status === "TODO" && task.dueDate.slice(0, 10) < today ? " / Overdue" : ""}</span><label>Study date<input aria-label={`Study date for ${task.title}`} type="date" min={today} disabled={busy} value={task.dueDate.slice(0, 10)} onChange={(e) => e.target.value && void change(task, { dueDate: e.target.value })} /></label><label>Minutes<input aria-label={`Minutes for ${task.title}`} type="number" min={5} max={120} disabled={busy} defaultValue={task.minutes} key={`${task.id}-${task.version}`} onBlur={e => editMinutes(task, e.currentTarget)} /></label>{task.href && <Link href={task.href}>Open activity</Link>}<button disabled={busy} onClick={() => void change(task, { status: task.status === "SKIPPED" ? "TODO" : "SKIPPED" })}>{task.status === "SKIPPED" ? "Restore task" : "Skip"}</button></div>
      </li>)}</ul>
    </>}
    {plan && <form className="commerce-form" onSubmit={addTask}><h2>Plan a study task</h2><label className="journey-field">Available activity<select name="choice" disabled={busy || !choices.length}>{choices.map((choice, index) => <option value={index} key={`${choice.kind}-${choice.resourceId}`}>{choice.title}</option>)}</select></label>{!choices.length && <p>No available lessons or practice activities.</p>}<label className="journey-field">Study date<input name="dueDate" type="date" min={today} defaultValue={today} required /></label><label className="journey-field">Minutes<input name="minutes" type="number" min={5} max={120} defaultValue={25} required /></label><button disabled={busy || !choices.length}>Add task</button></form>}
    <section className="journey-session"><h2>Study session</h2>{session ? <><p>{session.topic} / Started {new Date(session.startedAt).toLocaleTimeString()}</p><output aria-label="Session elapsed time">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</output>{seconds > 720 * 60 && <p role="alert">Session minutes are capped at 12 hours. Finish this session before starting another.</p>}</> : <><label className="journey-field">Mission<select value={selectedTask} onChange={e => { setSelectedTask(e.target.value); const task = plan?.tasks.find(task => task.id === e.target.value); if (task) setTopic(task.title.slice(0, 120)); }}><option value="">Independent study</option>{plan?.tasks.filter(task => task.status === "TODO").map(task => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label><label className="journey-field">Study topic<input maxLength={120} value={topic} onChange={(e) => setTopic(e.target.value)} /></label></>}<button className="journey-primary" disabled={busy || (!session && topic.trim().length < 2)} onClick={() => void timer()}>{session ? "Finish session" : "Start session"}</button></section>
    {overview && <section><h2>Recent weekly sessions</h2>{overview.sessionsTruncated && <p role="status">Showing the latest 100 sessions; minute totals are partial.</p>}<ul>{overview.sessions.map(entry => <li key={entry.id}>{entry.topic} / {new Date(entry.endedAt!).toLocaleString()}</li>)}</ul>{!overview.sessions.length && <p>No finished sessions in this week.</p>}</section>}
  </main>;
}
