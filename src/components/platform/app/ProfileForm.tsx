"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "../Icon";
import { ImageDropzone } from "../ImageDropzone";
import { toast } from "../AppToaster";
import { updateCandidateProfile } from "@/server/actions/platform";
import { educationStages, indianStates, languages, languageCodes } from "@/shared/india";
import { districtsFor } from "@/shared/india-districts";

export type ProfileDefaults = {
  name: string;
  dateOfBirth: string;
  gender: string;
  state: string;
  city: string;
  education: string;
  preferredLanguage: string;
  phone: string;
  avatarUrl: string;
  dailyStudyMinutes: number;
  timezone: string;
};

const genders = [
  { value: "FEMALE", label: "Female" },
  { value: "MALE", label: "Male" },
  { value: "NON_BINARY", label: "Non-binary" },
  { value: "PREFER_NOT_TO_SAY", label: "Prefer not to say" },
];

function normaliseLanguage(value: string) {
  if (languages.includes(value as (typeof languages)[number])) return value;
  const entry = Object.entries(languageCodes).find(([, code]) => code === value);
  return entry?.[0] ?? "English";
}

export function ProfileForm({ defaults }: { defaults: ProfileDefaults }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ ...defaults, preferredLanguage: normaliseLanguage(defaults.preferredLanguage) });
  const [uploading, setUploading] = useState(false);
  const districts = districtsFor(form.state);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const toastId = toast.loading("Saving your profile…");
    startTransition(async () => {
      const result = await updateCandidateProfile({
        name: form.name,
        dateOfBirth: form.dateOfBirth,
        gender: form.gender,
        state: form.state,
        city: form.city,
        education: form.education,
        preferredLanguage: form.preferredLanguage,
        phone: form.phone,
        avatarUrl: form.avatarUrl,
        dailyStudyMinutes: Number(form.dailyStudyMinutes),
        timezone: form.timezone,
      });
      if (!result.ok) {
        toast.error(result.message, { id: toastId });
        return;
      }
      toast.success("Profile saved.", { id: toastId });
      router.refresh();
    });
  }

  return (
    <form className="tp-card tp-card-pad" onSubmit={submit}>
      <div className="tp-row-between" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 18 }}>Personal details</h2>
          <p className="tp-xs tp-faint" style={{ marginTop: 3 }}>Used only for your account and preparation analytics.</p>
        </div>
      </div>

      <div className="tp-form-grid">
        <div className="tp-field tp-span-2">
          <label className="tp-label" htmlFor="profile-name">Full name <span>*</span></label>
          <input id="profile-name" className="tp-input" value={form.name} onChange={(event) => update("name", event.target.value)} required />
        </div>
        <div className="tp-field">
          <label className="tp-label" htmlFor="profile-dob">Date of birth <span>*</span></label>
          <input id="profile-dob" className="tp-input" type="date" value={form.dateOfBirth} onChange={(event) => update("dateOfBirth", event.target.value)} required />
        </div>
        <div className="tp-field">
          <label className="tp-label" htmlFor="profile-gender">Gender</label>
          <select id="profile-gender" className="tp-select" value={form.gender} onChange={(event) => update("gender", event.target.value)}>
            {genders.map((gender) => <option key={gender.value} value={gender.value}>{gender.label}</option>)}
          </select>
        </div>
        <div className="tp-field">
          <label className="tp-label" htmlFor="profile-state">State or UT <span>*</span></label>
          <select
            id="profile-state"
            className="tp-select"
            value={form.state}
            onChange={(event) => {
              const state = event.target.value;
              setForm((current) => ({
                ...current,
                state,
                city: districtsFor(state).includes(current.city) ? current.city : "",
              }));
            }}
          >
            {indianStates.map((state) => <option key={state} value={state}>{state}</option>)}
          </select>
        </div>
        <div className="tp-field">
          <label className="tp-label" htmlFor="profile-district">District <span>*</span></label>
          <select
            id="profile-district"
            className="tp-select"
            value={form.city}
            onChange={(event) => update("city", event.target.value)}
            required
          >
            <option value="">Choose a district</option>
            {districts.map((district) => <option key={district} value={district}>{district}</option>)}
          </select>
          <span className="tp-hint">{districts.length} districts in {form.state}.</span>
        </div>
        <div className="tp-field">
          <label className="tp-label" htmlFor="profile-education">Current stage</label>
          <select id="profile-education" className="tp-select" value={form.education} onChange={(event) => update("education", event.target.value)}>
            {educationStages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
          </select>
        </div>
        <div className="tp-field">
          <label className="tp-label" htmlFor="profile-language">Preferred language</label>
          <select id="profile-language" className="tp-select" value={form.preferredLanguage} onChange={(event) => update("preferredLanguage", event.target.value)}>
            {languages.map((language) => <option key={language} value={language}>{language}</option>)}
          </select>
        </div>
        <div className="tp-field">
          <label className="tp-label" htmlFor="profile-phone">Phone</label>
          <input id="profile-phone" className="tp-input" value={form.phone} onChange={(event) => update("phone", event.target.value)} placeholder="+91 98765 43210" />
        </div>
        <div className="tp-field">
          <label className="tp-label" htmlFor="profile-minutes">Daily study minutes</label>
          <input
            id="profile-minutes"
            className="tp-input"
            type="number"
            min={15}
            max={720}
            value={form.dailyStudyMinutes}
            onChange={(event) => update("dailyStudyMinutes", Number(event.target.value))}
          />
        </div>
        <div className="tp-field tp-span-2">
          <span className="tp-label">Profile picture</span>
          <ImageDropzone value={form.avatarUrl} onChange={(url) => update("avatarUrl", url)} onBusyChange={setUploading} compact />
        </div>
        <div className="tp-field">
          <label className="tp-label" htmlFor="profile-timezone">Timezone</label>
          <input id="profile-timezone" className="tp-input" value={form.timezone} onChange={(event) => update("timezone", event.target.value)} />
          <span className="tp-hint">Scheduling uses Asia/Kolkata by default.</span>
        </div>
      </div>

      <div className="tp-row-between tp-mt-24">
        <span className="tp-xs tp-faint">Changing your date of birth may affect eligibility checks.</span>
        <button type="submit" className="tp-btn" disabled={pending || uploading}>
          {uploading ? "Uploading image…" : pending ? "Saving…" : "Save profile"} {pending || uploading ? null : <Icon name="check" size={15} />}
        </button>
      </div>
    </form>
  );
}
