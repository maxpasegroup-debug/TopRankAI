"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "../Icon";
import { beginDailyExam } from "@/server/actions/platform";

export function StartExamButton({ dailyExamId }: { dailyExamId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function start() {
    setError(null);
    startTransition(async () => {
      const result = await beginDailyExam(dailyExamId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="tp-stack tp-gap-8">
      <button type="button" className="tp-btn tp-btn-lg" onClick={start} disabled={pending}>
        {pending ? "Starting…" : "Start the paper"} {pending ? null : <Icon name="play" size={15} />}
      </button>
      {error ? <div className="tp-error" role="alert">{error}</div> : null}
    </div>
  );
}
