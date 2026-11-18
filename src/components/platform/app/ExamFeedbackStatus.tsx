"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getExamFeedbackStatus } from "@/server/actions/platform";

export function ExamFeedbackStatus({ attemptId }: { attemptId: string }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const deadline = Date.now() + 60_000;

    async function check() {
      let pending = true;
      try {
        ({ pending } = await getExamFeedbackStatus(attemptId));
      } catch {
        // Keep the saved result visible while retrying a temporary network failure.
      }
      if (cancelled) return;
      if (!pending || Date.now() >= deadline) {
        router.refresh();
        return;
      }
      timer = setTimeout(check, 2500);
    }

    timer = setTimeout(check, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [attemptId, router]);

  return <p className="tp-xs tp-faint tp-mt-12" role="status">Your score is ready. Feedback is being prepared and will appear here automatically.</p>;
}
