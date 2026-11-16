"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Icon } from "../Icon";
import { readAllNotifications, readNotification } from "@/server/actions/platform";

export function NotificationActions({ unread, id }: { unread: number; id?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function markOne() {
    if (!id) return;
    startTransition(async () => {
      await readNotification(id);
      router.refresh();
    });
  }

  function markAll() {
    startTransition(async () => {
      await readAllNotifications();
      router.refresh();
    });
  }

  if (id) {
    return (
      <button type="button" className="tp-btn tp-btn-ghost tp-btn-sm" onClick={markOne} disabled={pending}>
        Mark read
      </button>
    );
  }

  return (
    <button type="button" className="tp-btn tp-btn-soft tp-btn-sm" onClick={markAll} disabled={pending || unread === 0}>
      <Icon name="check" size={14} /> {unread === 0 ? "All read" : `Mark all read (${unread})`}
    </button>
  );
}
