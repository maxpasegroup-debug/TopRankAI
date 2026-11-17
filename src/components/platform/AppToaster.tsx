"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Toaster as HotToaster, toast, type Toast } from "react-hot-toast";

export { toast };

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
};

let cancelActive: (() => void) | null = null;

/** Close a confirmation that is still open when the route changes. */
export function dismissConfirm() {
  cancelActive?.();
  toast.dismiss("tp-confirm");
}

/**
 * A confirmation rendered as a toast with two actions. It replaces the old
 * inline "submit this paper?" card, which lived below the question and was easy
 * to miss.
 */
export function confirmAction({
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
}: ConfirmOptions): Promise<boolean> {
  // A second confirmation replaces the first, which counts as a cancel.
  cancelActive?.();
  return new Promise<boolean>((resolve) => {
    let settled = false;
    let id = "";

    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      if (cancelActive === cancel) cancelActive = null;
      toast.dismiss(id);
      resolve(value);
    };
    const cancel = () => finish(false);
    cancelActive = cancel;

    id = toast.custom(
      (t: Toast) => (
        <div className="tp-toast-card" data-visible={t.visible} role="alertdialog" aria-label={title}>
          <h4>{title}</h4>
          {description ? <p>{description}</p> : null}
          <div className="tp-toast-actions">
            <button type="button" className="tp-btn tp-btn-ghost tp-btn-sm" onClick={() => finish(false)}>
              {cancelLabel}
            </button>
            <button
              type="button"
              className={`tp-btn tp-btn-sm ${tone === "danger" ? "tp-btn-danger" : ""}`}
              onClick={() => finish(true)}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      ),
      { duration: Infinity, position: "top-center", id: "tp-confirm" },
    );
  });
}

export function AppToaster() {
  const pathname = usePathname();
  useEffect(() => {
    // A confirmation belongs to the page that opened it. Do not leave a stale
    // "Submit and score" or "Remove exam" action floating over the next page.
    dismissConfirm();
  }, [pathname]);

  return (
    <HotToaster
      position="top-center"
      gutter={10}
      containerStyle={{ top: 74 }}
      toastOptions={{
        duration: 4200,
        style: {
          background: "var(--tp-surface)",
          color: "var(--tp-ink)",
          border: "1px solid var(--tp-line-strong)",
          borderRadius: 12,
          boxShadow: "0 18px 50px rgba(8, 6, 18, 0.22)",
          fontSize: 13,
          fontWeight: 550,
          maxWidth: "min(440px, calc(100vw - 28px))",
          padding: "10px 14px",
        },
        success: { iconTheme: { primary: "var(--tp-ok)", secondary: "var(--tp-surface)" } },
        error: {
          duration: 6000,
          iconTheme: { primary: "var(--tp-danger)", secondary: "var(--tp-surface)" },
          style: { borderColor: "color-mix(in srgb, var(--tp-danger) 35%, var(--tp-line-strong))" },
        },
        loading: { iconTheme: { primary: "var(--tp-brand)", secondary: "var(--tp-surface)" } },
      }}
    />
  );
}
