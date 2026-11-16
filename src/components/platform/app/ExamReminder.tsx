"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function ExamReminder({ title, startsAt, refreshAt, estimate = false }: {
  title: string; startsAt: number; refreshAt: number; estimate?: boolean;
}) {
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    const refresh = window.setTimeout(() => router.refresh(), Math.max(100, refreshAt - Date.now() + 100));
    return () => { window.clearInterval(tick); window.clearTimeout(refresh); };
  }, [refreshAt, router]);
  const minutes = now === null ? null : Math.ceil((startsAt - now) / 60_000);
  const time = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(startsAt);
  return <div className="tp-note tp-mb-20">
    <strong>{title}</strong> · {estimate ? "Estimated " : ""}{time} IST{minutes !== null && minutes > 0 ? ` (in ${Math.floor(minutes / 60)}h ${minutes % 60}m)` : ""}.
    {" "}Take a break, review your mistakes and prepare for your next paper.
  </div>;
}
