"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/platform/Icon";
import { PasswordInput } from "@/components/platform/auth/PasswordInput";
import { LogoMark } from "@/components/platform/Logo";
import { toast } from "@/components/platform/AppToaster";
import { ImageDropzone } from "@/components/platform/ImageDropzone";
import { registerCandidate } from "@/server/actions/auth";
import { educationStages, indianStates, languages } from "@/shared/india";
import { districtsFor } from "@/shared/india-districts";

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
  { value: "BEGINNER", label: "Beginner", minutes: 30, hint: "1 full paper a day" },
  { value: "INTERMEDIATE", label: "Intermediate", minutes: 45, hint: "2 full papers a day" },
  { value: "ADVANCED", label: "Advanced", minutes: 90, hint: "3 full papers a day" },
  { value: "EXTREME", label: "Extreme", minutes: 120, hint: "4 full papers a day" },
];

const genders = [
  { value: "FEMALE", label: "Female" },
  { value: "MALE", label: "Male" },
  { value: "NON_BINARY", label: "Non-binary" },
  { value: "PREFER_NOT_TO_SAY", label: "Prefer not to say" },
];

/** One question per screen. `intro` welcomes, `review` confirms. */
const stepOrder = [
  "intro",
  "name",
  "email",
  "password",
  "phone",
  "dob",
  "gender",
  "state",
  "district",
  "education",
  "language",
  "photo",
  "exams",
  "plan",
  "review",
] as const;

type Step = (typeof stepOrder)[number];

const prompts: Record<Step, { question: string; detail: string }> = {
  intro: {
    question: "Let's get to know you.",
    detail: "About two minutes of questions. Everything you tell me shapes your workspace, and nothing is shared with other candidates.",
  },
  name: { question: "What should I call you?", detail: "Your full name, as you want it to appear on your account." },
  email: { question: "Where can I reach you?", detail: "Your sign-in email and where account notices go. I will not send marketing." },
  password: { question: "Choose a password.", detail: "At least 8 characters. Only you will know it." },
  phone: { question: "What is your mobile number?", detail: "Optional. Used only if support needs to reach you." },
  dob: { question: "When were you born?", detail: "Self-registration is currently for candidates aged 18 and over." },
  gender: { question: "How do you identify?", detail: "Optional. It is only used in anonymised statistics." },
  state: { question: "Which state or union territory are you in?", detail: "Used to pick your district next, and to show local exam dates." },
  district: { question: "Which district?", detail: "The list follows the state you chose." },
  education: { question: "What are you studying right now?", detail: "This sets the baseline difficulty of your first papers." },
  language: { question: "Which language do you prefer?", detail: "Your interface stays in English for now; this records your preference." },
  photo: { question: "Add a profile picture?", detail: "Optional. A clear square photo works best. You can add one later." },
  exams: { question: "Which exams are you preparing for?", detail: "Choose every exam you want a daily paper for. You can change this later." },
  plan: { question: "How hard should each exam push you?", detail: "Each level sets how many full papers you get a day and a daily study target." },
  review: { question: "Does this look right?", detail: "Check your details, accept the terms, and I will create your workspace." },
};

export function RegisterConversation({ groups, currentYear }: { groups: Group[]; currentYear: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [index, setIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(groups[0]?.slug ?? null);
  const [account, setAccount] = useState({ name: "", email: "", password: "", confirm: "", phone: "" });
  const [profile, setProfile] = useState({
    dateOfBirth: "",
    gender: "PREFER_NOT_TO_SAY",
    state: "",
    district: "",
    education: "Class 12",
    preferredLanguage: "English",
    avatarUrl: "",
  });
  const [selected, setSelected] = useState<Selected[]>([]);
  const [accepted, setAccepted] = useState(false);

  const step = stepOrder[index];
  const answerArea = useRef<HTMLFormElement>(null);

  const maxDob = useMemo(() => {
    const date = new Date(currentYear - 18, new Date().getMonth(), new Date().getDate());
    return date.toISOString().slice(0, 10);
  }, [currentYear]);

  const districts = useMemo(() => districtsFor(profile.state), [profile.state]);

  const examById = useMemo(() => {
    const map = new Map<string, RegistrationExam>();
    for (const group of groups) for (const exam of group.exams) map.set(exam.id, exam);
    return map;
  }, [groups]);

  useEffect(() => {
    const first = answerArea.current?.querySelector<HTMLElement>("input:not([type=hidden]), select, textarea");
    // Focus follows the question so the flow can be completed from the keyboard.
    first?.focus({ preventScroll: true });
  }, [index]);

  function update<K extends keyof typeof profile>(key: K, value: (typeof profile)[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

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

  function problem(): string | null {
    if (step === "name" && account.name.trim().length < 2) return "Tell me your name so I can set up your account.";
    if (step === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(account.email)) return "That email does not look complete. Check it and try again.";
    if (step === "password" && account.password.length < 8) return "Use at least 8 characters for your password.";
    if (step === "password" && account.password !== account.confirm) return "The two passwords do not match.";
    if (step === "phone" && account.phone.trim() && !/^[+]?[0-9 -]{7,16}$/.test(account.phone.trim())) {
      return "Enter a phone number such as +91 98765 43210, or skip this step.";
    }
    if (step === "dob" && !profile.dateOfBirth) return "Choose your date of birth.";
    if (step === "dob" && profile.dateOfBirth > maxDob) return "Self-registration is available for candidates aged 18 and over.";
    if (step === "state" && !profile.state) return "Choose your state or union territory.";
    if (step === "district" && !profile.district) return "Choose your district.";
    if (step === "exams" && !selected.length) return "Choose at least one exam.";
    if (step === "review" && !accepted) return "Accept the terms and privacy notice to create the account.";
    return null;
  }

  function goTo(next: number) {
    setIndex(Math.max(0, Math.min(stepOrder.length - 1, next)));
  }

  function next() {
    const issue = problem();
    if (issue) {
      toast.error(issue);
      return;
    }
    goTo(index + 1);
  }

  function skip() {
    if (step === "phone") setAccount({ ...account, phone: "" });
    if (step === "photo") update("avatarUrl", "");
    next();
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (step === "review") {
      createAccount();
      return;
    }
    next();
  }

  function createAccount() {
    const issue = problem();
    if (issue) {
      toast.error(issue);
      return;
    }
    const toastId = toast.loading("Creating your account…");
    startTransition(async () => {
      const result = await registerCandidate({
        name: account.name.trim(),
        email: account.email.trim().toLowerCase(),
        password: account.password,
        phone: account.phone.trim(),
        dateOfBirth: profile.dateOfBirth,
        gender: profile.gender,
        state: profile.state,
        city: profile.district,
        education: profile.education,
        preferredLanguage: profile.preferredLanguage,
        avatarUrl: profile.avatarUrl.trim(),
        termsAccepted: true,
        privacyAccepted: true,
        exams: selected.map((item) => ({
          examId: item.examId,
          partCode: item.partCode,
          level: item.level,
          targetYear: item.targetYear,
          dailyMinutes: item.dailyMinutes,
        })),
      });
      if (!result.ok) {
        toast.error(result.message, { id: toastId });
        return;
      }
      toast.success("Account created. Opening your dashboard…", { id: toastId });
      router.replace(result.redirectTo);
      router.refresh();
    });
  }

  function answerFor(id: Step): string {
    switch (id) {
      case "name": return account.name.trim();
      case "email": return account.email.trim();
      case "password": return "••••••••";
      case "phone": return account.phone.trim() || "Skipped";
      case "dob": return profile.dateOfBirth
        ? new Date(`${profile.dateOfBirth}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
        : "";
      case "gender": return genders.find((gender) => gender.value === profile.gender)?.label ?? profile.gender;
      case "state": return profile.state;
      case "district": return profile.district;
      case "education": return profile.education;
      case "language": return profile.preferredLanguage;
      case "photo": return profile.avatarUrl ? "Picture added" : "Skipped";
      case "exams": return selected.map((item) => examById.get(item.examId)?.shortName ?? examById.get(item.examId)?.name ?? "Exam").join(", ");
      case "plan": return `${selected.length} exam${selected.length === 1 ? "" : "s"} set`;
      default: return "";
    }
  }

  function planSummary(): string {
    return selected
      .map((item) => {
        const exam = examById.get(item.examId);
        const label = exam?.shortName ?? exam?.name ?? "Exam";
        const level = levels.find((entry) => entry.value === item.level)?.label ?? item.level;
        return `${label}: ${level}, ${item.targetYear}, ${item.dailyMinutes} min/day`;
      })
      .join(" · ");
  }

  const progress = Math.round(((index + 1) / stepOrder.length) * 100);

  return (
    <section
      className="flex w-full max-w-[620px] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
      aria-labelledby="registration-question"
    >
      <header className="flex items-center justify-between gap-3 border-b border-line bg-surface-2 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-gradient-to-br from-brand to-[var(--tp-violet)] text-white">
            <LogoMark size={16} />
          </span>
          <span className="min-w-0">
            <strong className="block truncate text-[13.5px] font-bold text-ink">TopRank guide</strong>
            <small className="block truncate text-[11px] text-muted">Creating your account</small>
          </span>
        </div>
        <Link className="tp-btn tp-btn-ghost tp-btn-sm" href="/">
          <Icon name="x" size={15} /> <span className="hidden min-[420px]:inline">Close</span>
        </Link>
      </header>

      <div className="h-1 w-full bg-surface-3" aria-hidden="true">
        <div className="h-full bg-brand transition-[width] duration-300" style={{ width: `${progress}%` }} />
      </div>

      <div className="px-4 pt-4 sm:px-5">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
          {step === "intro" ? "Welcome" : step === "review" ? "One last check" : `Question ${index} of ${stepOrder.length - 2}`}
        </p>
        <h1 id="registration-question" className="text-[clamp(19px,3.6vw,23px)] font-bold leading-tight tracking-[-0.02em] text-ink" aria-live="polite">
          {prompts[step].question}
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{prompts[step].detail}</p>
      </div>

      <form ref={answerArea} className="flex flex-1 flex-col gap-3 px-4 pb-4 pt-4 sm:px-5" onSubmit={submit}>
        {step === "intro" ? (
          <ul className="grid gap-2 text-[13px] text-muted">
            {[
              "Your name, contact details and where you study",
              "Your state and district, from a list",
              "A profile picture, if you want one",
              "The exams you are preparing for and how hard to push",
            ].map((line) => (
              <li key={line} className="flex gap-2">
                <span className="mt-0.5 text-ok"><Icon name="check" size={15} /></span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {step === "name" ? (
          <label className="tp-field">
            <span className="tp-label">Full name</span>
            <input
              className="tp-input"
              value={account.name}
              onChange={(event) => setAccount({ ...account, name: event.target.value })}
              autoComplete="name"
              placeholder="e.g. Ananya Menon"
              maxLength={120}
              required
            />
          </label>
        ) : null}

        {step === "email" ? (
          <label className="tp-field">
            <span className="tp-label">Email address</span>
            <input
              className="tp-input"
              type="email"
              value={account.email}
              onChange={(event) => setAccount({ ...account, email: event.target.value })}
              autoComplete="email"
              placeholder="you@example.com"
              maxLength={254}
              required
            />
          </label>
        ) : null}

        {step === "password" ? (
          <div className="grid gap-3 min-[420px]:grid-cols-2">
            <label className="tp-field">
              <span className="tp-label">Password</span>
              <PasswordInput
                className="tp-input"
                value={account.password}
                onChange={(event) => setAccount({ ...account, password: event.target.value })}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                minLength={8}
                required
              />
            </label>
            <label className="tp-field">
              <span className="tp-label">Confirm password</span>
              <PasswordInput
                className="tp-input"
                value={account.confirm}
                onChange={(event) => setAccount({ ...account, confirm: event.target.value })}
                autoComplete="new-password"
                placeholder="Type it again"
                minLength={8}
                required
              />
            </label>
          </div>
        ) : null}

        {step === "phone" ? (
          <label className="tp-field">
            <span className="tp-label">Mobile number <span className="tp-faint">(optional)</span></span>
            <input
              className="tp-input"
              value={account.phone}
              onChange={(event) => setAccount({ ...account, phone: event.target.value })}
              autoComplete="tel"
              inputMode="tel"
              placeholder="+91 98765 43210"
            />
          </label>
        ) : null}

        {step === "dob" ? (
          <label className="tp-field">
            <span className="tp-label">Date of birth</span>
            <input
              className="tp-input"
              type="date"
              max={maxDob}
              value={profile.dateOfBirth}
              onChange={(event) => update("dateOfBirth", event.target.value)}
              required
            />
          </label>
        ) : null}

        {step === "gender" ? (
          <div className="grid gap-2 min-[420px]:grid-cols-2">
            {genders.map((gender) => (
              <button
                key={gender.value}
                type="button"
                className="tp-choice"
                data-active={profile.gender === gender.value}
                onClick={() => {
                  update("gender", gender.value);
                  goTo(index + 1);
                }}
              >
                {gender.label}
              </button>
            ))}
          </div>
        ) : null}

        {step === "state" ? (
          <label className="tp-field">
            <span className="tp-label">State or union territory</span>
            <select
              className="tp-select"
              value={profile.state}
              onChange={(event) => {
                const state = event.target.value;
                setProfile((current) => ({ ...current, state, district: "" }));
                if (state) goTo(index + 1);
              }}
              required
            >
              <option value="">Choose a state</option>
              {indianStates.map((state) => <option key={state} value={state}>{state}</option>)}
            </select>
          </label>
        ) : null}

        {step === "district" ? (
          <label className="tp-field">
            <span className="tp-label">District in {profile.state}</span>
            <select
              className="tp-select"
              value={profile.district}
              onChange={(event) => {
                update("district", event.target.value);
                if (event.target.value) goTo(index + 1);
              }}
              required
            >
              <option value="">Choose a district</option>
              {districts.map((district) => <option key={district} value={district}>{district}</option>)}
            </select>
            <span className="tp-hint">{districts.length} districts in the list. Go back to change your state.</span>
          </label>
        ) : null}

        {step === "education" ? (
          <div className="grid gap-2 min-[420px]:grid-cols-2">
            {educationStages.map((stage) => (
              <button
                key={stage}
                type="button"
                className="tp-choice"
                data-active={profile.education === stage}
                onClick={() => {
                  update("education", stage);
                  goTo(index + 1);
                }}
              >
                {stage}
              </button>
            ))}
          </div>
        ) : null}

        {step === "language" ? (
          <div className="grid gap-2 min-[420px]:grid-cols-2">
            {languages.map((language) => (
              <button
                key={language}
                type="button"
                className="tp-choice"
                data-active={profile.preferredLanguage === language}
                onClick={() => {
                  update("preferredLanguage", language);
                  goTo(index + 1);
                }}
              >
                {language}
              </button>
            ))}
          </div>
        ) : null}

        {step === "photo" ? (
          <ImageDropzone value={profile.avatarUrl} onChange={(url) => update("avatarUrl", url)} onBusyChange={setUploading} />
        ) : null}

        {step === "exams" ? (
          <div className="grid max-h-[46vh] gap-2 overflow-y-auto pr-1">
            <p className="text-xs text-muted">Choose every exam you want a daily paper for. You can add more later.</p>
            {groups.map((group) => {
              const open = openGroup === group.slug;
              const chosen = group.exams.some((exam) => selected.some((item) => item.examId === exam.id));
              return (
                <div className="rounded-sm border border-line" key={group.slug}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
                    onClick={() => setOpenGroup(open ? null : group.slug)}
                    aria-expanded={open}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-semibold text-ink">{group.name}</span>
                      <span className="block text-[11.5px] text-faint">{group.exams.length} exam{group.exams.length === 1 ? "" : "s"}</span>
                    </span>
                    <span className="flex flex-none items-center gap-2">
                      {chosen ? <span className="tp-pill tp-pill-brand">Selected</span> : null}
                      <Icon name="chevron-down" size={17} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 180ms ease", color: "var(--tp-faint)" }} />
                    </span>
                  </button>
                  {open ? (
                    <div className="grid gap-1.5 px-3 pb-3">
                      {group.exams.map((exam) => {
                        const isChosen = selected.some((item) => item.examId === exam.id);
                        return (
                          <label key={exam.id} className="tp-exam-option" data-selected={isChosen}>
                            <input type="checkbox" checked={isChosen} onChange={() => toggleExam(exam)} />
                            <span className="tp-grow">
                              <h4>{exam.shortName ?? exam.name}</h4>
                              <p>{exam.subjectNames.slice(0, 4).join(" · ")}</p>
                            </span>
                            <span className="tp-xs tp-faint tp-nowrap">
                              {exam.parts[0]
                                ? `${exam.parts[0].totalQuestions}Q · ${exam.parts[0].durationMinutes}m`
                                : `${exam.dailyTestQuestions}Q · ${exam.dailyTestMinutes}m`}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
            <p className="text-xs text-muted">
              {selected.length ? `${selected.length} selected` : "Nothing selected yet"}
            </p>
          </div>
        ) : null}

        {step === "plan" ? (
          <div className="grid max-h-[46vh] gap-3 overflow-y-auto pr-1">
            {selected.map((item) => {
              const exam = examById.get(item.examId);
              return (
                <div key={item.examId} className="rounded-sm border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-[13.5px] text-ink">{exam?.shortName ?? exam?.name ?? "Exam"}</strong>
                    <span className="tp-xs tp-faint">{item.dailyMinutes} min study/day</span>
                  </div>
                  <div className="tp-level-select mt-2">
                    {levels.map((level) => (
                      <button
                        key={level.value}
                        type="button"
                        className="tp-level-btn"
                        data-active={item.level === level.value}
                        onClick={() => setLevel(item.examId, level.value)}
                        title={level.hint}
                      >
                        {level.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {exam && exam.parts.length > 1 ? (
                      <label className="flex items-center gap-1.5 text-xs text-muted">
                        Paper
                        <select
                          className="tp-select"
                          style={{ minHeight: 32, padding: "2px 28px 2px 8px", fontSize: 12, width: "auto", maxWidth: "100%" }}
                          value={item.partCode ?? exam.parts[0]?.code ?? ""}
                          onChange={(event) => setSelected((current) => current.map((entry) => entry.examId === item.examId ? { ...entry, partCode: event.target.value } : entry))}
                        >
                          {exam.parts.map((part) => (
                            <option key={part.code} value={part.code}>{part.name} · {part.totalQuestions}Q / {part.totalMarks} marks</option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <label className="flex items-center gap-1.5 text-xs text-muted">
                      Target year
                      <select
                        className="tp-select"
                        style={{ minHeight: 32, padding: "2px 28px 2px 8px", fontSize: 12, width: "auto" }}
                        value={item.targetYear}
                        onChange={(event) => setSelected((current) => current.map((entry) => entry.examId === item.examId ? { ...entry, targetYear: Number(event.target.value) } : entry))}
                      >
                        {Array.from({ length: 7 }, (_, offset) => currentYear + offset + 1).map((year) => <option key={year} value={year}>{year}</option>)}
                      </select>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {step === "review" ? (
          <div className="grid max-h-[42vh] gap-3 overflow-y-auto pr-1">
            <dl className="grid gap-1.5 text-[13px]">
              {[
                ["Name", account.name],
                ["Email", account.email],
                ["Phone", account.phone.trim() || "Not added"],
                ["Date of birth", answerFor("dob")],
                ["Gender", answerFor("gender")],
                ["Location", [profile.district, profile.state].filter(Boolean).join(", ")],
                ["Stage", profile.education],
                ["Language", profile.preferredLanguage],
                ["Exams", answerFor("exams")],
                ["Plan", planSummary() || "Not set"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b border-line pb-1.5 last:border-0">
                  <dt className="text-muted">{label}</dt>
                  <dd className="text-right font-semibold text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            <label className="tp-check">
              <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
              <span>
                I accept the <Link className="tp-link" href="/terms" target="_blank">terms of use</Link> and the{" "}
                <Link className="tp-link" href="/privacy" target="_blank">privacy notice</Link>, and I confirm the details above.
              </span>
            </label>
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
          {index > 0 ? (
            <button
              type="button"
              className="tp-btn tp-btn-ghost tp-btn-sm"
              onClick={() => goTo(index - 1)}
              disabled={pending || uploading}
            >
              <Icon name="arrow-left" size={15} /> Back
            </button>
          ) : (
            <span aria-hidden="true" />
          )}

          <div className="flex flex-wrap items-center gap-2">
            {step === "phone" || step === "photo" ? (
              <button type="button" className="tp-btn tp-btn-ghost tp-btn-sm" onClick={skip} disabled={pending || uploading}>
                Skip
              </button>
            ) : null}

            {step === "review" ? (
              <button type="button" className="tp-btn tp-btn-lg" onClick={createAccount} disabled={pending || uploading || !accepted}>
                {pending ? "Creating account…" : "Create my account"} {pending ? null : <Icon name="check" size={16} />}
              </button>
            ) : (
              <button type="submit" className="tp-btn" disabled={pending || uploading}>
                {step === "intro" ? "Let's start" : step === "plan" ? "Review my answers" : "Continue"} <Icon name="arrow-right" size={16} />
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-[11.5px] text-faint">
          {step === "intro" ? (
            <>Already have an account? <Link className="tp-link" href="/login">Sign in</Link></>
          ) : (
            <>You can step back with Back. Nothing is saved until the last question.</>
          )}
        </p>
      </form>
    </section>
  );
}
