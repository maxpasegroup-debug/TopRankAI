"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Icon } from "../Icon";
import { toast } from "../AppToaster";
import { completeRevisionItem, dismissRevisionItem } from "@/server/actions/platform";

export function RevisionActions({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function act(kind: "complete" | "dismiss") {
    const toastId = toast.loading(kind === "complete" ? "Clearing this revision…" : "Dismissing this revision…");
    startTransition(async () => {
      const result = kind === "complete" ? await completeRevisionItem(id) : await dismissRevisionItem(id);
      if (!result.ok) {
        toast.error(result.message ?? "Could not update this item.", { id: toastId });
        return;
      }
      toast.success(kind === "complete" ? "Revision cleared." : "Revision dismissed.", { id: toastId });
      router.refresh();
    });
  }

  return (
    <div className="tp-stack tp-gap-8" style={{ alignItems: "flex-end" }}>
      <div className="tp-row tp-gap-8">
        <button type="button" className="tp-btn tp-btn-soft tp-btn-sm" onClick={() => act("complete")} disabled={pending}>
          <Icon name="check" size={14} /> Done
        </button>
        <button type="button" className="tp-btn tp-btn-ghost tp-btn-sm" onClick={() => act("dismiss")} disabled={pending}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
