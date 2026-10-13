"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { studentRequest } from "./client";
import { PageContainer } from "@/components/ui/PageContainer";

type Profile = { aspiration: string | null; targetExamId: string | null; targetYear: number | null;
  dreamCollege: string | null; targetScore: string | null; dailyStudyMins: number | null;
  preparationStart: string | null; focusSubjectIds: string[]; onboardingCompletedAt?: string | null };
type Journey = { profile: Profile | null; exams: { id: string; name: string; category: string }[];
  subjects: { id: string; name: string }[] };
type Draft = { previewToken: string; tasks: { title: string; subject: string; minutes: number; dueDate: string }[] };
const steps = ["Meet SIA", "Dream Book", "Exam & Goal", "Create Your Board", "Mission Control"];
const defaults: Profile = { aspiration: "", targetExamId: "", targetYear: new Date().getFullYear() + 1,
  dreamCollege: "", targetScore: "", dailyStudyMins: 120, preparationStart: new Date().toISOString().slice(0, 10), focusSubjectIds: [] };

export function JourneyWizard() {
  const router = useRouter();
  const [journey, setJourney] = useState<Journey | null>(null);
  const [profile, setProfile] = useState<Profile>(defaults);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [requestKey, setRequestKey] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    let active = true;
    studentRequest<Journey>("/api/student/journey").then((data) => {
      if (!active) return;
      setJourney(data);
      if (data.profile) setProfile({ ...defaults, ...Object.fromEntries(Object.entries(data.profile).filter(([, value]) => value !== null)),
        preparationStart: data.profile.preparationStart?.slice(0, 10) ?? defaults.preparationStart } as Profile);
      if (data.profile?.onboardingCompletedAt) setStep(4);
      else if ((data.profile?.aspiration?.trim().length ?? 0) >= 2) setStep(2);
    }).catch((e: Error) => active && setError(e.message));
    return () => { active = false; };
  }, []);
  function update<K extends keyof Profile>(key: K, value: Profile[K]) { setProfile((p) => ({ ...p, [key]: value })); }
  async function next() {
    setBusy(true); setError("");
    try {
      if (step === 1) {
        if ((profile.aspiration?.trim().length ?? 0) < 2) throw new Error("Enter your aspiration before continuing");
        await studentRequest("/api/student/journey", "PUT", { aspiration: profile.aspiration });
      }
      if (step === 2) {
        const { onboardingCompletedAt: _completed, ...preferences } = profile;
        await studentRequest("/api/student/journey", "PUT", preferences);
        setDraft(await studentRequest<Draft>("/api/student/missions/preview"));
        setRequestKey(crypto.randomUUID());
      }
      if (step === 3) await studentRequest("/api/student/missions", "POST", { requestKey, title: "My study mission", previewToken: draft?.previewToken });
      if (step === 4) { router.push("/home"); router.refresh(); return; }
      setStep(step + 1);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save"); }
    finally { setBusy(false); }
  }
  async function chooseExam(id: string) {
    setBusy(true); setError("");
    try {
      await studentRequest("/api/student/journey", "PUT", { targetExamId: id });
      setJourney(await studentRequest<Journey>("/api/student/journey"));
      setProfile((p) => ({ ...p, targetExamId: id, focusSubjectIds: [] }));
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save"); } finally { setBusy(false); }
  }
  return <PageContainer><main className="journey-shell">
    <div className="journey-heading"><span className="journey-kicker">TOPRANK AI / SIA</span><p>{step + 1} / 5</p></div>
    <ol className="journey-steps">{steps.map((label, i) => <li key={label} aria-current={i === step ? "step" : undefined} className={i === step ? "current" : ""}>{label}</li>)}</ol>
    <h1>{steps[step]}</h1>
    {error && <p role="alert" className="journey-error">{error}</p>}
    {!journey ? <p role="status">{error ? "Journey unavailable" : "Loading your journey..."}</p> : <>
      {step === 0 && <div className="journey-welcome"><h2>A fresh start. A goal of your own.</h2><p>What would you like to work toward?</p><p>Your next seven days begin here.</p></div>}
      {step === 1 && <label className="journey-field">Your dream<textarea maxLength={2000} rows={6} value={profile.aspiration ?? ""} onChange={(e) => update("aspiration", e.target.value)} /></label>}
      {step === 2 && <div className="journey-fields">
        <label className="journey-field">Find an exam<input type="search" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <label className="journey-field">Target exam<select value={profile.targetExamId ?? ""} onChange={(e) => void chooseExam(e.target.value)} disabled={busy}><option value="" disabled>Select exam</option>{journey.exams.filter((e) => e.id === profile.targetExamId || e.name.toLowerCase().includes(search.toLowerCase())).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
        {!journey.exams.length && <p>No published exams are available.</p>}
        <label className="journey-field">Target year<input type="number" min={new Date().getFullYear()} max={new Date().getFullYear() + 8} value={profile.targetYear ?? ""} onChange={(e) => update("targetYear", Number(e.target.value))} /></label>
        <label className="journey-field">Dream college or career goal<input maxLength={160} value={profile.dreamCollege ?? ""} onChange={(e) => update("dreamCollege", e.target.value)} /></label>
        <label className="journey-field">Personal score target<input maxLength={120} value={profile.targetScore ?? ""} onChange={(e) => update("targetScore", e.target.value)} /></label>
        <label className="journey-field">Preparation start<input type="date" value={profile.preparationStart ?? ""} onChange={(e) => update("preparationStart", e.target.value)} /></label>
        <label className="journey-field">Daily study minutes<input type="number" min={30} max={720} step={10} value={profile.dailyStudyMins ?? ""} onChange={(e) => update("dailyStudyMins", Number(e.target.value))} /></label>
        <fieldset className="journey-subjects"><legend>Focus subjects</legend>{journey.subjects.map((s) => <label key={s.id}><input type="checkbox" checked={profile.focusSubjectIds.includes(s.id)} onChange={(e) => update("focusSubjectIds", e.target.checked ? [...profile.focusSubjectIds, s.id] : profile.focusSubjectIds.filter((id) => id !== s.id))} />{s.name}</label>)}</fieldset>
      </div>}
      {step === 3 && <div><h2>Your seven-day plan</h2><ul className="journey-task-list">{draft?.tasks.map((task, i) => <li key={i}><div><strong>{task.title}</strong><span>{task.subject} / {task.dueDate.slice(0, 10)}</span></div><span>{task.minutes} min</span></li>)}</ul></div>}
      {step === 4 && <div><h2>Your mission board is ready.</h2><p>{profile.dreamCollege}. One study day at a time.</p></div>}
      <div className="journey-actions">{step > 0 && step < 4 && <button type="button" disabled={busy} onClick={() => setStep(step - 1)}>Back</button>}<button className="journey-primary" disabled={busy || (step === 2 && (!profile.targetExamId || (profile.dreamCollege?.trim().length ?? 0) < 2))} onClick={() => void next()}>{busy ? "Saving..." : step === 3 ? "Confirm mission" : step === 4 ? "Open Mission Control" : "Continue"}</button></div>
    </>}
  </main></PageContainer>;
}
