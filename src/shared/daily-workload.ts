const levels = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXTREME"] as const;
export type DailyLevel = typeof levels[number];
export const EXAM_BREAK_MINUTES = 45;

export const DAILY_PAPERS = { BEGINNER: 1, INTERMEDIATE: 2, ADVANCED: 3, EXTREME: 4 } as const;

export function includedPapers(level: DailyLevel) {
  return DAILY_PAPERS[level];
}

export function levelForPapers(count: number) {
  return levels[Math.min(Math.max(count, 1), levels.length) - 1];
}

export function mockMonthlyActive(plan: { plan: string; status: string; endsAt: Date | null } | null, now = new Date()) {
  return plan?.plan === "MOCK_MONTHLY" && plan.status === "ACTIVE" && !!plan.endsAt && plan.endsAt > now;
}

// Fit the full first sitting, subsequent timed sets and all breaks between
// the 08:00 IST reminder and the end of the study day.
export function dailyCapacity(duration: number) {
  const followUpMinutes = Math.min(duration, 60);
  return 1 + Math.max(0, Math.floor((16 * 60 - duration) / (followUpMinutes + EXAM_BREAK_MINUTES)));
}

export function paperCount(level: DailyLevel, requested: number | null, monthly: boolean) {
  const included = includedPapers(level);
  return monthly ? requested ?? included : Math.min(included, requested ?? included);
}

export type ScheduledPaper = {
  slot: number;
  status: string;
  submittedAt: Date | null;
  attempt: { deadline: Date } | null;
};

// scheduledDate is the UTC date key for the Indian study day. An 08:00 IST
// first sitting is a reminder; candidates may start that first paper earlier.
export function dailySchedule(day: Date, count: number, duration: number, papers: ScheduledPaper[], previousDaySubmission?: Date | null) {
  let startsAt = new Date(day.getTime() + 150 * 60_000);
  const carryOver = previousDaySubmission ? previousDaySubmission.getTime() + EXAM_BREAK_MINUTES * 60_000 : 0;
  if (carryOver > Date.now()) startsAt = new Date(carryOver);
  return Array.from({ length: count }, (_, slot) => {
    const paper = papers.find((row) => row.slot === slot);
    const previous = papers.find((row) => row.slot === slot - 1);
    const available = slot === 0 ? carryOver <= Date.now() : Boolean(previous?.submittedAt && startsAt.getTime() <= Date.now());
    const sitting = { slot, startsAt, available, status: paper?.status ?? "SCHEDULED" };
    const finish = paper?.submittedAt ?? paper?.attempt?.deadline
      ?? new Date(Math.max(Date.now(), startsAt.getTime()) + (slot === 0 ? duration : Math.min(duration, 60)) * 60_000);
    startsAt = new Date(finish.getTime() + EXAM_BREAK_MINUTES * 60_000);
    return sitting;
  });
}
