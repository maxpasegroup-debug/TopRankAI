import { ExamReminder } from "./ExamReminder";
import { addDays, todayDate } from "@/server/platform/utils";
import type { dailySchedule } from "@/shared/daily-workload";

export function NextPaperNotice({ name, schedule, day = todayDate() }: {
  name: string; schedule: ReturnType<typeof dailySchedule>; day?: Date;
}) {
  const next = schedule.find((sitting) => sitting.status === "SCHEDULED");
  const tomorrow = addDays(day, 1).getTime();
  const midnight = tomorrow - 330 * 60_000;
  const tomorrowFirst = tomorrow + 150 * 60_000;
  const withinDay = next && next.startsAt.getTime() < midnight;
  const startsAt = withinDay ? next.startsAt.getTime() : tomorrowFirst;
  const refreshAt = startsAt > Date.now() ? Math.min(midnight, startsAt) : midnight;
  return <ExamReminder title={`${name} · ${withinDay ? `Paper ${next.slot + 1} of ${schedule.length}` : "Tomorrow’s first paper"}`}
    startsAt={startsAt} refreshAt={refreshAt} estimate={Boolean(withinDay && next.slot && schedule[next.slot - 1].status !== "SUBMITTED")} />;
}
