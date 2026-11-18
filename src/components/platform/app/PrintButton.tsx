"use client";

import { Icon } from "../Icon";

export function PrintButton({ label = "Print or save as PDF" }: { label?: string }) {
  return (
    <button type="button" className="tp-btn tp-btn-ghost tp-print-hide" onClick={() => window.print()}>
      <Icon name="print" size={15} /> {label}
    </button>
  );
}
