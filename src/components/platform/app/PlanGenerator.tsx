"use client";

import { useState, useTransition } from "react";
import { Icon } from "../Icon";
import { requestStudyPlan } from "@/server/actions/platform";
import type { StudyPlanSuggestion } from "@/server/ai/tasks";

export function PlanGenerator({ code }: { code: string }) {
  const [pending, startTransition] = useTransition();
  const [plan, setPlan] = useState<StudyPlanSuggestion | null>(null);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function generate() {
    setError(null);
    startTransition(async () => {
      const result = await requestStudyPlan(code);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setPlan(result.data.plan);
      setAiGenerated(result.data.aiGenerated);
    });
  }

  return (
    <div>
      <button type="button" className="tp-btn tp-btn-soft tp-btn-sm" onClick={generate} disabled={pending}>
        {pending ? "Building a plan…" : "Suggest a study plan"} {pending ? null : <Icon name="spark" size={14} />}
      </button>

      {error ? <div className="tp-error tp-mt-16" role="alert">{error}</div> : null}

      {plan ? (
        <div className="tp-stack tp-gap-12 tp-mt-16">
          <div className="tp-note">
            <div className="tp-row-between" style={{ marginBottom: 6 }}>
              <strong>{plan.focus}</strong>
              <span className={`tp-pill ${aiGenerated ? "tp-pill-brand" : ""}`}>{aiGenerated ? "AI-generated" : "Deterministic fallback"}</span>
            </div>
            <p>{plan.rationale}</p>
          </div>
          {plan.tasks.map((task, index) => (
            <div className="tp-goal" key={`${task.title}-${index}`}>
              <span className="tp-goal-check"><Icon name={task.kind === "REVISE" ? "refresh" : task.kind === "PRACTICE" ? "target" : "book"} /></span>
              <div className="tp-grow">
                <div className="tp-goal-title">{task.title}</div>
                <div className="tp-goal-meta">{task.kind.toLowerCase()} · {task.minutes} minutes</div>
              </div>
            </div>
          ))}
          {!aiGenerated ? (
            <p className="tp-xs tp-faint">
              The AI provider is not configured or unavailable, so this plan was built from your recorded weak topics
              by a deterministic rule set.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
