"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Icon } from "../Icon";
import { toast } from "../AppToaster";
import { requestTopicNotes, updateTopicProgress } from "@/server/actions/platform";

type Status = "NOT_STARTED" | "LEARNING" | "COMPLETED" | "NEEDS_REVISION";

const options: { value: Status; label: string }[] = [
  { value: "NOT_STARTED", label: "Not started" },
  { value: "LEARNING", label: "Learning" },
  { value: "COMPLETED", label: "Completed" },
  { value: "NEEDS_REVISION", label: "Needs revision" },
];

export function TopicActions({
  topicId,
  status,
  bookmarked,
  hasAiNotes = false,
}: {
  topicId: string;
  status: Status;
  bookmarked: boolean;
  hasAiNotes?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notesPending, startNotes] = useTransition();

  function setStatus(next: Status) {
    const toastId = toast.loading("Updating this topic…");
    startTransition(async () => {
      const result = await updateTopicProgress({ topicId, status: next });
      if (!result.ok) {
        toast.error(result.message, { id: toastId });
        return;
      }
      toast.success(`Marked as ${options.find((option) => option.value === next)?.label ?? "updated"}.`, { id: toastId });
      router.refresh();
    });
  }

  function toggleBookmark() {
    const toastId = toast.loading(bookmarked ? "Removing from saved topics…" : "Saving this topic…");
    startTransition(async () => {
      const result = await updateTopicProgress({ topicId, status, bookmarked: !bookmarked });
      if (!result.ok) {
        toast.error(result.message, { id: toastId });
        return;
      }
      toast.success(bookmarked ? "Removed from saved topics." : "Saved to your topics.", { id: toastId });
      router.refresh();
    });
  }

  function generateNotes() {
    const toastId = toast.loading("Generating detailed notes…");
    startNotes(async () => {
      const result = await requestTopicNotes(topicId);
      if (!result.ok) {
        toast.error(result.message, { id: toastId });
        return;
      }
      toast.success("AI study notes added below. Review them critically.", { id: toastId });
      router.refresh();
    });
  }

  return (
    <div className="tp-card tp-card-pad">
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Track this topic</h3>
      <div className="tp-stack tp-gap-8">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className="tp-side-link"
            data-active={status === option.value}
            style={{ width: "100%", border: 0, background: status === option.value ? "var(--tp-brand-soft)" : "transparent", cursor: "pointer" }}
            onClick={() => setStatus(option.value)}
            disabled={pending}
          >
            <Icon name={status === option.value ? "check" : "target"} size={17} />
            <span>{option.label}</span>
          </button>
        ))}
      </div>

      <button type="button" className="tp-btn tp-btn-ghost tp-btn-sm tp-btn-block tp-mt-16" onClick={toggleBookmark} disabled={pending}>
        <Icon name="star" size={14} /> {bookmarked ? "Remove from saved" : "Save topic"}
      </button>

      <div className="tp-divider" style={{ margin: "18px 0" }} />

      <h3 style={{ fontSize: 16, marginBottom: 6 }}>AI study notes</h3>
      <p className="tp-xs tp-faint" style={{ lineHeight: 1.5, marginBottom: 10 }}>
        {hasAiNotes
          ? "Regenerates the detailed notes for this topic and updates the same saved note instead of creating a duplicate."
          : "Writes detailed, syllabus-grounded notes for this topic. Labelled AI-generated and saved for later."}
      </p>
      <button type="button" className="tp-btn tp-btn-soft tp-btn-sm tp-btn-block" onClick={generateNotes} disabled={notesPending}>
        {notesPending ? "Generating…" : hasAiNotes ? "Regenerate notes" : "Generate notes"} {notesPending ? null : <Icon name="spark" size={14} />}
      </button>
    </div>
  );
}
