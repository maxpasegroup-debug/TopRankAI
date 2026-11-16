"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Icon } from "@/components/platform/Icon";
import { registerCandidate } from "@/server/actions/auth";
import { educationStages, indianStates, languages } from "@/shared/india";

type RegistrationExam = {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  subjectNames: string[];
  dailyTestQuestions: number;
  dailyTestMinutes: number;
  parts: { code: string; name: string; durationMinutes: number; totalQuestions: number; totalMarks: number; verified: boolean }[];
};

type Group = { name: string; slug: string; exams: RegistrationExam[] };

type Level = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXTREME";
type Selected = { examId: string; partCode?: string; level: Level; targetYear: number; dailyMinutes: number };

const levels: { value: Level; label: string; minutes: number; hint: string }[] = [
  { value: "BEGINNER", label: "Beginner", minutes: 30, hint: "1 paper/day" },
  { value: "INTERMEDIATE", label: "Intermediate", minutes: 45, hint: "2 papers/day" },
  { value: "ADVANCED", label: "Advanced", minutes: 90, hint: "3 papers/day" },
  { value: "EXTREME", label: "Extreme", minutes: 120, hint: "4 papers/day" },
];

const genders = [
  { value: "FEMALE", label: "Female" },
  { value: "MALE", label: "Male" },
  { value: "NON_BINARY", label: "Non-binary" },
  { value: "PREFER_NOT_TO_SAY", label: "Prefer not to say" },
];

const stepTitles = ["Account", "Profile", "Exams", "Review"];

export function RegisterWizard({ groups, currentYear }: { groups: Group[]; currentYear: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState({ name: "", email: "", password: "", confirm: "", phone: "" });
  const [profile, setProfile] = useState({
    dateOfBirth: "",
    gender: "PREFER_NOT_TO_SAY",
    state: "Kerala",
    city: "",
    education: "Class 12",
    preferredLanguage: "English",
    avatarUrl: "",
  });
  const [selected, setSelected] = useState<Selected[]>([]);
  const [accepted, setAccepted] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const maxDob = useMemo(() => {
    const date = new Date(currentYear - 18, new Date().getMonth(), new Date().getDate());
    return date.toISOString().slice(0, 10);
  }, [currentYear]);

  const examById = useMemo(() => {
    const map = new Map<string, RegistrationExam>();
    for (const group of groups) for (const exam of group.exams) map.set(exam.id, exam);
    return map;
  }, [groups]);

  function toggleExam(exam: RegistrationExam) {
    setSelected((current) => {
      if (current.some((item) => item.examId === exam.id)) return current.filter((item) => item.examId !== exam.id);
      return [...current, { examId: exam.id, partCode: exam.parts[0]?.code, level: "INTERMEDIATE", targetYear: currentYear + 1, dailyMinutes: 45 }];
    });
  }

  function setLevel(examId: string, level: Level) {
    const minutes = levels.find((item) => item.value === level)?.minutes ?? 45;
    setSelected((current) => current.map((item) => (item.examId === examId ? { ...item, level, dailyMinutes: minutes } : item)));
  }

  function validateStep(): string | null {
    if (step === 0) {
      if (account.name.trim().length < 2) return "Enter your full name.";
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(account.email)) return "Enter a valid email address.";
      if (account.password.length < 8) return "Use at least 8 characters for your password.";
      if (account.password !== account.confirm) return "The passwords do not match.";
      return null;
    }
    if (step === 1) {
      if (!profile.dateOfBirth) return "Enter your date of birth.";
      if (profile.dateOfBirth > maxDob) return "Self-registration is available for candidates aged 18 and over.";
      if (profile.city.trim().length < 2) return "Enter your city.";
      return null;
    }
    if (step === 2) {
      if (!selected.length) return "Choose at least one exam to prepare for.";
      return null;
    }
    if (step === 3 && !accepted) return "Accept the terms and privacy notice to continue.";
    return null;
  }

  function next() {
    const problem = validateStep();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setStep((value) => Math.min(3, value + 1));
  }

  function submit() {
    const problem = validateStep();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await registerCandidate({
        name: account.name.trim(),
        email: account.email.trim().toLowerCase(),
        password: account.password,
        phone: account.phone.trim(),
        dateOfBirth: profile.dateOfBirth,
        gender: profile.gender,
        state: profile.state,
        city: profile.city.trim(),
        education: profile.education,
        preferredLanguage: profile.preferredLanguage,
        avatarUrl: profile.avatarUrl.trim(),
        termsAccepted: true,
        privacyAccepted: true,
        exams: selected.map((item) => ({ examId: item.examId, partCode: item.partCode, level: item.level, targetYear: item.targetYear, dailyMinutes: item.dailyMinutes })),
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.replace(result.redirectTo);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="tp-steps-bar" aria-hidden="true">
        {stepTitles.map((title, index) => <span key={title} data-done={index <= step} />)}
      </div>
      <div className="tp-row-between" style={{ marginBottom: 18 }}>
        <div>
          <div className="tp-eyebrow">Step {step + 1} of 4</div>
          <h2 style={{ fontSize: 24, marginTop: 8, letterSpacing: "-0.03em" }}>{stepTitles[step]}</h2>
        </div>
        <span className="tp-pill">{selected.length} exam{selected.length === 1 ? "" : "s"} selected</span>
      </div>

      {error ? <div className="tp-error" role="alert" style={{ marginBottom: 16 }}>{error}</div> : null}

      {step === 0 ? (
        <div className="tp-form-grid">
          <div className="tp-field tp-span-2">
            <label className="tp-label" htmlFor="name">Full name <span>*</span></label>
            <input id="name" className="tp-input" value={account.name} onChange={(event) => setAccount({ ...account, name: event.target.value })} autoComplete="name" placeholder="As it should appear on your account" />
          </div>
          <div className="tp-field tp-span-2">
            <label className="tp-label" htmlFor="reg-email">Email address <span>*</span></label>
            <input id="reg-email" className="tp-input" type="email" value={account.email} onChange={(event) => setAccount({ ...account, email: event.target.value })} autoComplete="email" placeholder="you@example.com" />
          </div>
          <div className="tp-field">
            <label className="tp-label" htmlFor="reg-password">Password <span>*</span></label>
            <input id="reg-password" className="tp-input" type="password" value={account.password} onChange={(event) => setAccount({ ...account, password: event.target.value })} autoComplete="new-password" placeholder="At least 8 characters" />
          </div>
          <div className="tp-field">
            <label className="tp-label" htmlFor="reg-confirm">Confirm password <span>*</span></label>
            <input id="reg-confirm" className="tp-input" type="password" value={account.confirm} onChange={(event) => setAccount({ ...account, confirm: event.target.value })} autoComplete="new-password" placeholder="Repeat your password" />
          </div>
          <div className="tp-field tp-span-2">
            <label className="tp-label" htmlFor="reg-phone">Phone number (optional)</label>
            <input id="reg-phone" className="tp-input" value={account.phone} onChange={(event) => setAccount({ ...account, phone: event.target.value })} autoComplete="tel" placeholder="+91 98765 43210" />
            <span className="tp-hint">Used only for account support. Never shown to other candidates.</span>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="tp-form-grid">
          <div className="tp-field">
            <label className="tp-label" htmlFor="dob">Date of birth <span>*</span></label>
            <input id="dob" className="tp-input" type="date" max={maxDob} value={profile.dateOfBirth} onChange={(event) => setProfile({ ...profile, dateOfBirth: event.target.value })} />
            <span className="tp-hint">Self-registration is currently limited to candidates aged 18 and over.</span>
          </div>
          <div className="tp-field">
            <label className="tp-label" htmlFor="gender">Gender</label>
            <select id="gender" className="tp-select" value={profile.gender} onChange={(event) => setProfile({ ...profile, gender: event.target.value })}>
              {genders.map((gender) => <option key={gender.value} value={gender.value}>{gender.label}</option>)}
            </select>
          </div>
          <div className="tp-field">
            <label className="tp-label" htmlFor="state">State or union territory <span>*</span></label>
            <select id="state" className="tp-select" value={profile.state} onChange={(event) => setProfile({ ...profile, state: event.target.value })}>
              {indianStates.map((state) => <option key={state} value={state}>{state}</option>)}
            </select>
          </div>
          <div className="tp-field">
            <label className="tp-label" htmlFor="city">City <span>*</span></label>
            <input id="city" className="tp-input" value={profile.city} onChange={(event) => setProfile({ ...profile, city: event.target.value })} autoComplete="address-level2" placeholder="Where you study" />
          </div>
          <div className="tp-field">
            <label className="tp-label" htmlFor="education">Current stage</label>
            <select id="education" className="tp-select" value={profile.education} onChange={(event) => setProfile({ ...profile, education: event.target.value })}>
              {educationStages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
            </select>
          </div>
          <div className="tp-field">
            <label className="tp-label" htmlFor="language">Preferred language</label>
            <select id="language" className="tp-select" value={profile.preferredLanguage} onChange={(event) => setProfile({ ...profile, preferredLanguage: event.target.value })}>
              {languages.map((language) => <option key={language} value={language}>{language}</option>)}
            </select>
          </div>
          <div className="tp-field tp-span-2">
            <label className="tp-label" htmlFor="avatar">Profile picture URL (optional)</label>
            <input id="avatar" className="tp-input" value={profile.avatarUrl} onChange={(event) => setProfile({ ...profile, avatarUrl: event.target.value })} placeholder="https://…" />
            <span className="tp-hint">Paste a direct image link. You can update this later from your profile.</span>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div>
          <p className="tp-small tp-muted" style={{ marginBottom: 16 }}>
            Choose every exam you are preparing for. Each selected exam gets its own preparation level.
          </p>
          <div className="tp-stack tp-gap-12">
            {groups.map((group) => {
              const open = openGroup === group.slug;
              return (
                <div className="tp-card" key={group.slug} style={{ overflow: "hidden" }}>
                  <button
                    type="button"
                    className="tp-row-between"
                    onClick={() => setOpenGroup(open ? null : group.slug)}
                    style={{ width: "100%", padding: "16px 18px", border: 0, background: "transparent", cursor: "pointer", textAlign: "left" }}
                  >
                    <span>
                      <span style={{ fontWeight: 650, fontSize: 14.5, display: "block" }}>{group.name}</span>
                      <span className="tp-xs tp-faint">{group.exams.length} exam{group.exams.length === 1 ? "" : "s"}</span>
                    </span>
                    <span className="tp-row tp-gap-8">
                      {selected.some((item) => group.exams.some((exam) => exam.id === item.examId)) ? <span className="tp-pill tp-pill-brand">Selected</span> : null}
                      <Icon name="chevron-down" size={18} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 180ms ease", color: "var(--tp-faint)" }} />
                    </span>
                  </button>
                  {open ? (
                    <div className="tp-stack tp-gap-10" style={{ padding: "0 18px 18px" }}>
                      {group.exams.map((exam) => {
                        const choice = selected.find((item) => item.examId === exam.id);
                        return (
                          <div key={exam.id}>
                            <label className="tp-exam-option" data-selected={Boolean(choice)}>
                              <input type="checkbox" checked={Boolean(choice)} onChange={() => toggleExam(exam)} />
                              <span className="tp-grow">
                                <h4>{exam.shortName ?? exam.name}</h4>
                                <p>{exam.subjectNames.slice(0, 4).join(" · ")}</p>
                              </span>
                              <span className="tp-xs tp-faint tp-nowrap">
                                {exam.parts[0]
                                  ? `${exam.parts[0].totalQuestions}Q · ${exam.parts[0].durationMinutes}m official`
                                  : `${exam.dailyTestQuestions}Q · ${exam.dailyTestMinutes}m`}
                              </span>
                            </label>
                            {choice ? (
                              <div style={{ padding: "8px 4px 4px 30px" }}>
                                <div className="tp-level-select">
                                  {levels.map((level) => (
                                    <button
                                      type="button"
                                      key={level.value}
                                      className="tp-level-btn"
                                      data-active={choice.level === level.value}
                                      onClick={() => setLevel(exam.id, level.value)}
                                      title={level.hint}
                                    >
                                      {level.label}
                                    </button>
                                  ))}
                                </div>
                                {exam.parts.length > 1 ? (
                                  <label className="tp-xs tp-muted tp-row tp-gap-4 tp-mt-8" style={{ flexWrap: "wrap" }}>
                                    Paper
                                    <select
                                      className="tp-select"
                                      style={{ minHeight: 32, padding: "2px 28px 2px 8px", fontSize: 12, width: "auto", maxWidth: "100%" }}
                                      value={choice.partCode ?? exam.parts[0]?.code ?? ""}
                                      onChange={(event) => setSelected((current) => current.map((item) => item.examId === exam.id ? { ...item, partCode: event.target.value } : item))}
                                    >
                                      {exam.parts.map((part) => (
                                        <option key={part.code} value={part.code}>
                                          {part.name} · {part.totalQuestions}Q / {part.totalMarks} marks
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                ) : exam.parts[0] ? (
                                  <div className="tp-xs tp-faint tp-mt-8">
                                    {exam.parts[0].name} · {exam.parts[0].totalQuestions} questions · {exam.parts[0].totalMarks} marks
                                  </div>
                                ) : null}
                                <div className="tp-row tp-gap-12 tp-mt-8" style={{ flexWrap: "wrap" }}>
                                  <label className="tp-xs tp-muted tp-row tp-gap-4">
                                    Target year
                                    <select
                                      className="tp-select"
                                      style={{ minHeight: 32, padding: "2px 28px 2px 8px", fontSize: 12, width: "auto" }}
                                      value={choice.targetYear}
                                      onChange={(event) => setSelected((current) => current.map((item) => item.examId === exam.id ? { ...item, targetYear: Number(event.target.value) } : item))}
                                    >
                                      {Array.from({ length: 7 }, (_, index) => currentYear + index + 1).map((year) => <option key={year} value={year}>{year}</option>)}
                                    </select>
                                  </label>
                                  <span className="tp-xs tp-faint">{choice.dailyMinutes} min/day suggested</span>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="tp-stack tp-gap-16">
          <div className="tp-card tp-card-pad">
            <h3 style={{ fontSize: 16, marginBottom: 12 }}>Your account</h3>
            <div className="tp-stack tp-gap-8">
              {[
                ["Name", account.name],
                ["Email", account.email],
                ["Phone", account.phone || "Not added"],
              ].map(([label, value]) => (
                <div className="tp-row-between tp-small" key={label}>
                  <span className="tp-muted">{label}</span>
                  <span style={{ fontWeight: 600 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="tp-card tp-card-pad">
            <h3 style={{ fontSize: 16, marginBottom: 12 }}>Your profile</h3>
            <div className="tp-stack tp-gap-8">
              {[
                ["Date of birth", profile.dateOfBirth],
                ["Gender", genders.find((gender) => gender.value === profile.gender)?.label ?? profile.gender],
                ["Location", `${profile.city}, ${profile.state}`],
                ["Stage", profile.education],
                ["Language", profile.preferredLanguage],
              ].map(([label, value]) => (
                <div className="tp-row-between tp-small" key={label}>
                  <span className="tp-muted">{label}</span>
                  <span style={{ fontWeight: 600 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="tp-card tp-card-pad">
            <h3 style={{ fontSize: 16, marginBottom: 12 }}>Your exams</h3>
            <div className="tp-stack tp-gap-8">
              {selected.map((item) => {
                const exam = examById.get(item.examId);
                return (
                  <div className="tp-row-between tp-small" key={item.examId}>
                    <span style={{ fontWeight: 600 }}>{exam?.shortName ?? exam?.name ?? "Exam"}</span>
                    <span className="tp-row tp-gap-8">
                      <span className="tp-pill tp-pill-brand">{levels.find((level) => level.value === item.level)?.label}</span>
                      <span className="tp-xs tp-faint">
                        {exam?.parts.find((part) => part.code === item.partCode)?.name ?? item.targetYear}
                        {exam?.parts.length && item.partCode ? ` · ${item.targetYear}` : ""}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <label className="tp-check">
            <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
            <span>
              I accept the <Link className="tp-link" href="/terms" target="_blank">terms of use</Link> and the{" "}
              <Link className="tp-link" href="/privacy" target="_blank">privacy notice</Link>, and I confirm the
              information above is accurate.
            </span>
          </label>
        </div>
      ) : null}

      <div className="tp-row-between tp-mt-32">
        <button
          type="button"
          className="tp-btn tp-btn-ghost"
          onClick={() => { setError(null); setStep((value) => Math.max(0, value - 1)); }}
          disabled={step === 0 || pending}
        >
          <Icon name="arrow-left" size={16} /> Back
        </button>
        {step < 3 ? (
          <button type="button" className="tp-btn" onClick={next}>
            Continue <Icon name="arrow-right" size={16} />
          </button>
        ) : (
          <button type="button" className="tp-btn tp-btn-lg" onClick={submit} disabled={pending || !accepted}>
            {pending ? "Creating account…" : "Create my account"} {pending ? null : <Icon name="check" size={16} />}
          </button>
        )}
      </div>
    </div>
  );
}
