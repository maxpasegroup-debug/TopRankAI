"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { studentRequest } from "./client";
import { PageContainer } from "@/components/ui/PageContainer";

type Level = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXTREME";
type Target = { examId: string; targetYear: number; preparationLevel: Level; dailyMinutes: number };
type Exam = { id: string; name: string; code: string; category: string; description: string | null; officialUrl: string | null; status: "DRAFT" | "PUBLISHED" | "ARCHIVED" };
type Profile = { aspiration: string | null; targetExamId: string | null; targetYear: number | null; dreamCollege: string | null;
  targetScore: string | null; dailyStudyMins: number | null; preparationStart: string | null; focusSubjectIds: string[]; onboardingCompletedAt?: string | null };
type Journey = { profile: Profile | null; exams: Exam[]; targets: (Target & { exam: Pick<Exam, "id" | "name" | "code" | "category"> })[];
  subjects: { id: string; name: string }[] };
type Draft = { previewToken: string; tasks: { title: string; subject: string; minutes: number; dueDate: string; examId?: string }[] };

const steps = ["Welcome", "Choose exams", "Set your pace", "Review your first week", "Your workspace is ready"];
const currentYear = new Date().getFullYear();
const initialProfile: Profile = { aspiration: "", targetExamId: "", targetYear: currentYear + 1,
  dreamCollege: "My next goal", targetScore: "", dailyStudyMins: 90,
  preparationStart: new Date().toISOString().slice(0, 10), focusSubjectIds: [] };
const levelOptions: { value: Level; label: string; detail: string; minutes: number }[] = [
  { value: "BEGINNER", label: "Beginner", detail: "Build your foundations", minutes: 30 },
  { value: "INTERMEDIATE", label: "Intermediate", detail: "Steady practice and review", minutes: 45 },
  { value: "ADVANCED", label: "Advanced", detail: "A focused preparation routine", minutes: 90 },
  { value: "EXTREME", label: "Extreme", detail: "Peak-intensity exam readiness", minutes: 120 },
];

function makeTarget(examId: string, previous?: Target): Target {
  return previous ?? { examId, targetYear: currentYear + 1, preparationLevel: "INTERMEDIATE", dailyMinutes: 45 };
}

export function JourneyWizard() {
  const router = useRouter();
  const [journey, setJourney] = useState<Journey | null>(null);
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [targets, setTargets] = useState<Target[]>([]);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [requestKey, setRequestKey] = useState("");
  const [search, setSearch] = useState("");
  const groupedExams = useMemo(() => {
    const query = search.trim().toLowerCase();
    return journey?.exams.filter((exam) => !query || `${exam.name} ${exam.category} ${exam.code}`.toLowerCase().includes(query)) ?? [];
  }, [journey, search]);
  const categories = useMemo(() => [...new Set(groupedExams.map((exam) => exam.category || "Other exams"))], [groupedExams]);
  const dailyTotal = targets.reduce((total, target) => total + target.dailyMinutes, 0);

  useEffect(() => {
    let active = true;
    studentRequest<Journey>("/api/student/journey").then((data) => {
      if (!active) return;
      setJourney(data);
      if (data.profile) setProfile({ ...initialProfile, ...Object.fromEntries(Object.entries(data.profile).filter(([, value]) => value !== null)),
        preparationStart: data.profile.preparationStart?.slice(0, 10) ?? initialProfile.preparationStart } as Profile);
      const savedTargets = data.targets.map(({ exam, ...target }) => target);
      if (savedTargets.length) setTargets(savedTargets);
      else if (data.profile?.targetExamId) setTargets([makeTarget(data.profile.targetExamId, {
        examId: data.profile.targetExamId, targetYear: data.profile.targetYear ?? currentYear + 1, preparationLevel: "INTERMEDIATE", dailyMinutes: data.profile.dailyStudyMins ?? 45,
      })]);
      if (data.profile?.onboardingCompletedAt) setStep(4);
    }).catch((e: Error) => active && setError(e.message));
    return () => { active = false; };
  }, []);

  function update<K extends keyof Profile>(key: K, value: Profile[K]) { setProfile((current) => ({ ...current, [key]: value })); }
  function toggleExam(examId: string) {
    setTargets((current) => current.some((target) => target.examId === examId)
      ? current.filter((target) => target.examId !== examId)
      : [...current, makeTarget(examId)]);
  }
  function updateTarget(examId: string, patch: Partial<Target>) {
    setTargets((current) => current.map((target) => target.examId === examId ? { ...target, ...patch } : target));
  }

  async function next() {
    setBusy(true); setError("");
    try {
      if (step === 0) { setStep(1); return; }
      if (step === 1) {
        if (!targets.length) throw new Error("Choose at least one exam to build your plan.");
        setStep(2); return;
      }
      if (step === 2) {
        if (!targets.length) throw new Error("Choose at least one exam first.");
        if (dailyTotal < 30 || dailyTotal > 720) throw new Error("Set a combined daily study time between 30 minutes and 12 hours.");
        const first = targets[0];
        const saved = await studentRequest<{ profile: Profile }>("/api/student/journey", "PUT", {
          aspiration: profile.aspiration || "Preparing for my selected exams",
          targetExamId: first.examId,
          targetYear: first.targetYear,
          dailyStudyMins: dailyTotal,
          preparationStart: profile.preparationStart,
          dreamCollege: profile.dreamCollege || "My next goal",
          examTargets: targets,
        });
        setProfile((current) => ({ ...current, ...saved.profile }));
        setDraft(await studentRequest<Draft>("/api/student/missions/preview"));
        setRequestKey(crypto.randomUUID());
        setStep(3); return;
      }
      if (step === 3) {
        if (!draft) throw new Error("Review your plan again before continuing.");
        await studentRequest("/api/student/missions", "POST", { requestKey, title: "My daily exam preparation", previewToken: draft.previewToken });
        setStep(4); return;
      }
      router.push("/home"); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save your plan"); }
    finally { setBusy(false); }
  }

  return <PageContainer><main className="journey-shell candidate-onboarding">
    <div className="onboarding-topline"><a href="/" className="onboarding-brand"><span>t.</span> toprank</a><span>YOUR PREPARATION WORKSPACE</span></div>
    <div className="journey-heading"><span className="journey-kicker">PERSONALIZE YOUR PLAN</span><span>{Math.min(step + 1, steps.length)} / {steps.length}</span></div>
    <div className="onboarding-progress" aria-label={`Step ${step + 1} of ${steps.length}`}><span style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
    <h1>{steps[step]}</h1>
    {error && <p role="alert" className="journey-error">{error}</p>}
    {!journey ? <p role="status">{error ? "Your exam catalogue could not be loaded." : "Loading your exam catalogue…"}</p> : <>
      {step === 0 && <section className="onboarding-welcome"><span className="onboarding-icon">✳</span><p className="journey-kicker">A PLAN THAT FITS YOUR GOALS</p><h2>Prepare for the exams you choose, at the pace you choose.</h2><p>TopRank will keep each exam’s syllabus, practice, and progress in its own workspace. You can change your selections whenever your goals change.</p><div className="onboarding-points"><span>One account</span><span>Separate exam progress</span><span>A useful step each day</span></div></section>}
      {step === 1 && <section className="onboarding-selection"><div className="onboarding-exam-intro"><div><p className="journey-kicker">SELECT EVERY EXAM YOU’RE PREPARING FOR</p><p>Choose individual exams from their families. A family is just a way to browse; each exam keeps its own rules and syllabus.</p></div><span className="selection-count">{targets.length} selected</span></div>
        <label className="journey-field">Search exam or category<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Try JEE, PSC, banking…" /></label>
        {!journey.exams.length && <div className="catalogue-empty"><strong>The exam catalogue is being set up.</strong><p>Published exam entries will appear here after an administrator adds and reviews them.</p></div>}
        {categories.map((category) => <div className="onboarding-category" key={category}><h2>{category}</h2><div className="onboarding-exam-grid">{groupedExams.filter((exam) => (exam.category || "Other exams") === category).map((exam) => {
          const selected = targets.some((target) => target.examId === exam.id);
          const available = exam.status === "PUBLISHED";
          return <button type="button" key={exam.id} disabled={!available} className={`onboarding-exam ${selected ? "selected" : ""} ${available ? "" : "catalogue-coming"}`} aria-pressed={selected} onClick={() => toggleExam(exam.id)}><span className="exam-check">{selected ? "✓" : available ? "+" : "·"}</span><span><strong>{exam.name}</strong><small>{available ? exam.description || exam.category || "Competitive examination" : "Catalogue listed · syllabus and scoring review in progress"}</small></span><span className="exam-open">{available ? "↗" : "In review"}</span></button>;
        })}</div></div>)}
      </section>}
      {step === 2 && <section className="onboarding-pace"><div className="onboarding-exam-intro"><div><p className="journey-kicker">SET A DIFFERENT PACE FOR EACH EXAM</p><p>Choose an intensity and daily time that you can keep up. You can adjust these later.</p></div><span className="selection-count">{dailyTotal} min / day</span></div>
        <div className="pace-list">{targets.map((target) => { const exam = journey.exams.find((item) => item.id === target.examId); return <article className="pace-card" key={target.examId}><div className="pace-heading"><span className="exam-mark">{exam?.name.slice(0, 1) ?? "E"}</span><div><strong>{exam?.name ?? "Selected exam"}</strong><small>{exam?.category}</small></div><button type="button" className="remove-target" onClick={() => toggleExam(target.examId)} aria-label={`Remove ${exam?.name ?? "exam"}`}>Remove</button></div>
          <div className="pace-levels" role="group" aria-label={`Preparation intensity for ${exam?.name ?? "exam"}`}>{levelOptions.map((level) => <button type="button" className={target.preparationLevel === level.value ? "active" : ""} aria-pressed={target.preparationLevel === level.value} key={level.value} onClick={() => updateTarget(target.examId, { preparationLevel: level.value, dailyMinutes: level.minutes })}><strong>{level.label}</strong><small>{level.detail}</small></button>)}</div>
          <div className="pace-fields"><label className="journey-field">Target exam year<input type="number" min={currentYear} max={currentYear + 8} value={target.targetYear} onChange={(event) => updateTarget(target.examId, { targetYear: Number(event.target.value) })} /></label><label className="journey-field">Minutes per day<input type="number" min={15} max={720} step={5} value={target.dailyMinutes} onChange={(event) => updateTarget(target.examId, { dailyMinutes: Number(event.target.value) })} /></label></div>
        </article>; })}</div>
        <div className="daily-time-total"><span>Combined daily study time</span><strong>{Math.floor(dailyTotal / 60)} hr {dailyTotal % 60} min</strong><small>We’ll spread this across your selected exams, new practice, and due revision.</small></div>
        <label className="journey-field onboarding-start-date">When do you want your plan to begin?<input type="date" value={profile.preparationStart ?? ""} onChange={(event) => update("preparationStart", event.target.value)} /></label>
      </section>}
      {step === 3 && <section className="onboarding-plan"><div className="onboarding-exam-intro"><div><p className="journey-kicker">A FIRST LOOK AT YOUR PLAN</p><p>We’ll mix study and practice from your selected exams. Missed work should return gradually, not pile up without limit.</p></div><span className="selection-count">7 days</span></div>
        <div className="plan-preview-list">{draft?.tasks.map((task, index) => <article className="plan-preview-task" key={`${task.examId ?? "exam"}-${index}`}><span className="plan-day">{task.dueDate.slice(0, 10)}</span><div><strong>{task.title}</strong><small>{task.subject} · {task.minutes} min</small></div></article>)}</div>
        {!draft?.tasks.length && <div className="catalogue-empty"><strong>There is no reviewed learning content for this selection yet.</strong><p>Your exam choices are saved. An administrator needs to publish reviewed syllabus material before we can build a content-based schedule.</p></div>}
        <p className="plan-disclaimer">This is a study schedule, not a prediction of exam rank or selection.</p>
      </section>}
      {step === 4 && <section className="onboarding-ready"><span className="onboarding-icon">✓</span><p className="journey-kicker">YOUR STARTING POINT IS SET</p><h2>Your exam workspaces are ready.</h2><p>Each selected exam will have a separate place for its learning path, practice, assessments, and progress.</p><div className="ready-exams">{targets.map((target) => <span key={target.examId}>{journey.exams.find((exam) => exam.id === target.examId)?.name ?? "Exam"}</span>)}</div></section>}
      <div className="journey-actions onboarding-actions">{step > 0 && step < 4 && <button type="button" disabled={busy} onClick={() => setStep(step - 1)}>Back</button>}<button className="journey-primary" disabled={busy || !journey || step === 1 && !journey.exams.length || step === 2 && !targets.length || step === 3 && !draft?.tasks.length} onClick={() => void next()}>{busy ? "Saving your plan…" : step === 4 ? "Open today’s plan" : step === 3 ? "Start my daily loop" : step === 1 ? `Continue with ${targets.length} exam${targets.length === 1 ? "" : "s"}` : "Continue"}<span>↗</span></button></div>
    </>}
  </main></PageContainer>;
}
