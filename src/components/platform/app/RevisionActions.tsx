"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "../Icon";
import { completeRevisionItem, dismissRevisionItem } from "@/server/actions/platform";

export function RevisionActions({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function act(kind: "complete" | "dismiss") {
    setError(null);
    startTransition(async () => {
      const result = kind === "complete" ? await completeRevisionItem(id) : await dismissRevisionItem(id);
      if (!result.ok) {
        setError(result.message ?? "Could not update this item.");
        return;
      }
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
      {error ? <div className="tp-error tp-xs" role="alert">{error}</div> : null}
    </div>
  );
}
