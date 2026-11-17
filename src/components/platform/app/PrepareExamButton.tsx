"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Icon } from "../Icon";
import { toast } from "../AppToaster";
import { prepareDailyExam } from "@/server/actions/platform";

export function PrepareExamButton({
  code,
  slot = 0,
  label = "Prepare today's paper",
  className = "tp-btn tp-btn-lg",
  icon = "play",
}: {
  code: string;
  slot?: number;
  label?: string;
  className?: string;
  icon?: "play" | "spark" | "refresh";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function prepare() {
    startTransition(async () => {
      const toastId = toast.loading("Preparing today's paper…");
      const result = await prepareDailyExam(code, slot);
      if (!result.ok) {
        toast.error(result.message, { id: toastId });
        return;
      }
      toast.success("Today's paper is ready.", { id: toastId });
      router.push(`/app/daily/${result.data.id}`);
    });
  }

  return (
    <div className="tp-stack tp-gap-8">
      <button type="button" className={className} onClick={prepare} disabled={pending}>
        {pending ? "Preparing…" : label} {pending ? null : <Icon name={icon} size={16} />}
      </button>
    </div>
  );
}
