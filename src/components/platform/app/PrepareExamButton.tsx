"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "../Icon";
import { prepareDailyExam } from "@/server/actions/platform";

export function PrepareExamButton({
  code,
  label = "Prepare today's paper",
  className = "tp-btn tp-btn-lg",
  icon = "play",
}: {
  code: string;
  label?: string;
  className?: string;
  icon?: "play" | "spark" | "refresh";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function prepare() {
    setError(null);
    startTransition(async () => {
      const result = await prepareDailyExam(code);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(`/app/daily/${result.data.id}`);
    });
  }

  return (
    <div className="tp-stack tp-gap-8">
      <button type="button" className={className} onClick={prepare} disabled={pending}>
        {pending ? "Preparing…" : label} {pending ? null : <Icon name={icon} size={16} />}
      </button>
      {error ? <div className="tp-error" role="alert">{error}</div> : null}
    </div>
  );
}
