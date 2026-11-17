"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Icon } from "../Icon";
import { toast } from "../AppToaster";
import { beginDailyExam } from "@/server/actions/platform";

export function StartExamButton({ dailyExamId }: { dailyExamId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function start() {
    const toastId = toast.loading("Opening the paper…");
    startTransition(async () => {
      const result = await beginDailyExam(dailyExamId);
      if (!result.ok) {
        toast.error(result.message, { id: toastId });
        return;
      }
      toast.success("Paper started. Good luck.", { id: toastId });
      router.refresh();
    });
  }

  return (
    <div className="tp-stack tp-gap-8">
      <button type="button" className="tp-btn tp-btn-lg" onClick={start} disabled={pending}>
        {pending ? "Starting…" : "Start the paper"} {pending ? null : <Icon name="play" size={15} />}
      </button>
    </div>
  );
}
