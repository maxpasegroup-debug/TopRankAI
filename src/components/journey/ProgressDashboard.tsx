"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { studentRequest } from "./client";
import { AchievementHistory } from "@/components/competition/CompetitionWorkspace";
import type { getStudentEvidence } from "@/server/journey/progress";
import { accuracy } from "@/shared/progress-evidence";

type Progress = Awaited<ReturnType<typeof getStudentEvidence>>;
const percentage = (value: number | null) => value === null ? "No attempts" : `${value}%`;
export function ProgressDashboard() {
  const [data, setData] = useState<Progress | null>(null), [error, setError] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata"), [refresh, setRefresh] = useState(0);
  useEffect(() => { let active = true; setError(""); setData(null);
    studentRequest<Progress>(`/api/student/progress?timezone=${encodeURIComponent(timezone)}`).then(value => { if (active) setData(value); }).catch((e: Error) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [timezone, refresh]);
  return <main className="journey-shell" style={{ minWidth: 0, overflowWrap: "anywhere" }}><span className="journey-kicker">TOPRANK DIGITAL PROFILE</span><h1>My Progress</h1>
    <nav className="mock-links"><Link href="/home">Study board</Link><Link href="/practice/review">Practice history</Link><Link href="/practice/mock-tests">Mock history</Link><Link href="/consent">Consent & shared feedback</Link><Link href="/packages">Packages & access</Link></nav>
    <nav className="mock-links"><Link href="/get-help">Notifications & support</Link></nav>
    <div className="journey-actions"><label className="journey-field">Calendar timezone<select value={timezone} onChange={e => setTimezone(e.target.value)}><option value="Asia/Kolkata">India</option><option value="Asia/Dubai">UAE</option><option value="UTC">UTC</option></select></label><button onClick={() => setRefresh(value => value + 1)}>Refresh progress</button></div>
    {error && <p role="alert" className="journey-error">{error}<button onClick={() => setRefresh(value => value + 1)}>Retry</button></p>}
    {!data ? <p role="status">{error ? "Progress unavailable" : "Loading progress..."}</p> : <ProgressEvidence data={data} />}
    <AchievementHistory compact />
  </main>;
}
export function ProgressEvidence({ data }: { data: Progress }) {
  const formatDate = (value: string) => new Intl.DateTimeFormat("en", { timeZone: data.evidence.timezone, dateStyle: "medium" }).format(new Date(value));
  return <>
    <section><h2>{data.profile.displayName}</h2><p>{data.profile.targetExam?.name ?? "No target exam selected"}{data.profile.targetYear ? ` / ${data.profile.targetYear}` : ""}</p>{data.profile.dreamCollege && <p>Goal: {data.profile.dreamCollege}</p>}<p>Recorded through {formatDate(data.asOf)}</p></section>
    <section><h2>Your next step</h2><p>{data.guidance.suggestion}</p><Link href={data.guidance.href}>Continue preparation</Link></section>
    <section><h2>Recorded activity</h2><dl className="journey-metrics"><div><dt>Completed missions</dt><dd>{data.completedTasks}</dd></div><div><dt>Lessons marked complete</dt><dd>{data.completedLessons}</dd></div><div><dt>Practice submissions</dt><dd>{data.totals.practiceAttempts}</dd></div><div><dt>Practice accuracy</dt><dd>{percentage(accuracy(data.totals.practiceCorrect, data.totals.practiceAttempts))}</dd></div><div><dt>Finalized mocks</dt><dd>{data.totals.finalizedMocks}</dd></div></dl><p>Across your recorded exams. Completed activities and repeated attempts are not proof of mastery.</p></section>
    <section><h2>Last 28 days</h2><p>{data.evidence.start} to {data.evidence.today} / {data.evidence.recordedMinutes} recorded session minutes / {data.evidence.practice.uniqueQuestions} distinct practice questions</p>
      {Object.values(data.truncated).some(Boolean) && <p role="status">High activity volume: this view shows a bounded sample. Period totals and trends may be incomplete.</p>}
      {data.evidence.invalidMockResults > 0 && <p role="status">Some mock results need verification and are excluded from this view.</p>}
      <div className="mock-table-scroll" tabIndex={0} role="region" aria-label="Weekly progress"><table className="mock-table" style={{ minWidth: 760 }}><thead><tr><th>Week</th><th>Missions</th><th>Lessons</th><th>Minutes</th><th>Practice submissions</th><th>Practice accuracy</th><th>Mocks</th><th>Mock accuracy (answered)</th></tr></thead><tbody>{data.evidence.weeks.map(week => <tr key={week.from}><th>{week.from} to {week.to}</th><td>{week.missions}</td><td>{week.lessons}</td><td>{week.recordedMinutes}</td><td>{week.practiceAttempts}</td><td>{percentage(week.practiceAccuracy)}</td><td>{week.mocks}</td><td>{percentage(week.mockAccuracy)}</td></tr>)}</tbody></table></div>
      <p>Accuracy is based on submitted answers. Different questions and mock formats are not directly comparable.</p>
    </section>
    <section><h2>Practice by subject</h2>{data.evidence.subjects.length ? <div className="mock-table-scroll"><table className="mock-table"><thead><tr><th>Subject</th><th>Submissions</th><th>Distinct questions</th><th>Accuracy</th></tr></thead><tbody>{data.evidence.subjects.map(subject => <tr key={subject.id}><th>{subject.name}</th><td>{subject.attempts}</td><td>{subject.uniqueQuestions}</td><td>{percentage(subject.accuracy)}</td></tr>)}</tbody></table></div> : <p>No practice submissions in this period.</p>}<Link href="/practice/revision">Mistake-to-Mastery</Link></section>
    <section><h2>Recent mock results</h2>{data.evidence.mocks.length ? <ul className="journey-task-list">{data.evidence.mocks.map(mock => <li key={mock.id}><div><strong>{mock.title}</strong><span>{mock.status === "EXPIRED" ? "Time expired" : "Submitted"} / {mock.score} of {mock.maximumScore} / {percentage(accuracy(mock.correct, mock.answered))} accuracy on answered questions</span></div><Link href={`/practice/mock-attempts?attemptId=${encodeURIComponent(mock.id)}`}>Result</Link></li>)}</ul> : <p>No finalized mock results in this period.</p>}</section>
    <section><h2>Saved lessons</h2>{data.saved.length ? <ul className="journey-task-list">{data.saved.map(lesson => <li key={lesson.href}><Link href={lesson.href}>{lesson.title}</Link></li>)}</ul> : <p>No saved lessons yet.</p>}</section>
    <section><h2>Learning timeline</h2>{data.evidence.timeline.length ? <ul className="journey-task-list">{data.evidence.timeline.map(event => <li key={event.id}><div><strong>{event.title}</strong><span>{event.kind} / {formatDate(event.at)}</span></div><Link href={event.href}>View</Link></li>)}</ul> : <p>No recorded activity in this period.</p>}</section>
  </>;
}
