"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "../Icon";
import { useToastFeedback } from "../useToastFeedback";
import { setCandidateStatusAction } from "@/server/actions/admin";

export type AdminCandidateRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  location: string | null;
  status: string;
  joinedLabel: string;
  lastActiveLabel: string;
  onboarded: boolean;
  attempts: number;
  exams: { code: string; name: string; level: string }[];
};

export function CandidateAdmin({ candidates }: { candidates: AdminCandidateRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | "ACTIVE" | "SUSPENDED">("ALL");
  useToastFeedback(message, setMessage, error, setError);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return candidates.filter((candidate) => {
      if (status !== "ALL" && candidate.status !== status) return false;
      if (!query) return true;
      return [candidate.name, candidate.email, candidate.location ?? "", ...candidate.exams.map((exam) => exam.code)]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [candidates, search, status]);

  function toggle(candidate: AdminCandidateRow) {
    setMessage(null);
    setError(null);
    const next = candidate.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    startTransition(async () => {
      const result = await setCandidateStatusAction(candidate.id, next);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage(result.message);
      router.refresh();
    });
  }

  return (
    <div className="tp-stack tp-gap-16">
      <div className="tp-row-between tp-wrap tp-gap-12">
        <div className="tp-tabs">
          {(["ALL", "ACTIVE", "SUSPENDED"] as const).map((key) => (
            <button key={key} type="button" className="tp-tab" data-active={status === key} onClick={() => setStatus(key)}>
              {key === "ALL" ? "All" : key === "ACTIVE" ? "Active" : "Suspended"} (
              {key === "ALL" ? candidates.length : candidates.filter((candidate) => candidate.status === key).length})
            </button>
          ))}
        </div>
        <input
          className="tp-input"
          style={{ maxWidth: 280, minHeight: 38 }}
          placeholder="Search name, email or exam"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {filtered.length ? (
        <div className="tp-table-wrap">
          <table className="tp-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Location</th>
                <th>Plan</th>
                <th>Papers</th>
                <th>Joined</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((candidate) => (
                <tr key={candidate.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{candidate.name}</div>
                    <div className="tp-xs tp-faint">{candidate.email}</div>
                    {candidate.phone ? <div className="tp-xs tp-faint">{candidate.phone}</div> : null}
                  </td>
                  <td className="tp-xs">{candidate.location ?? "—"}</td>
                  <td>
                    {candidate.exams.length ? (
                      <div className="tp-row tp-gap-4 tp-wrap">
                        {candidate.exams.map((exam) => (
                          <span className="tp-pill" key={exam.code}>{exam.code} · {exam.level.slice(0, 3).toLowerCase()}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="tp-xs tp-faint">{candidate.onboarded ? "No active exam" : "Onboarding incomplete"}</span>
                    )}
                  </td>
                  <td>{candidate.attempts}</td>
                  <td className="tp-nowrap tp-xs">{candidate.joinedLabel}</td>
                  <td>
                    <span className={`tp-pill ${candidate.status === "ACTIVE" ? "tp-pill-ok" : "tp-pill-danger"}`}>{candidate.status.toLowerCase()}</span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      className={`tp-btn tp-btn-sm ${candidate.status === "ACTIVE" ? "tp-btn-danger" : "tp-btn-soft"}`}
                      onClick={() => toggle(candidate)}
                      disabled={pending}
                    >
                      {candidate.status === "ACTIVE" ? "Suspend" : "Reactivate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="tp-empty">
          <span className="tp-feature-icon" style={{ margin: 0 }}><Icon name="user" /></span>
          <h3>No candidate matches</h3>
          <p>Adjust the filter or search query.</p>
        </div>
      )}

      <div className="tp-note">
        <strong>Suspension is a real access control.</strong> Suspending an account blocks new sessions immediately.
        Existing results and attempts are preserved; nothing is deleted.
      </div>
    </div>
  );
}
