const levels = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXTREME"] as const;
export type DailyLevel = typeof levels[number];
export const EXAM_BREAK_MINUTES = 45;

export const DAILY_PAPERS = { BEGINNER: 1, INTERMEDIATE: 2, ADVANCED: 3, EXTREME: 4 } as const;
// Extra papers above the level allowance need the mock monthly plan. This is a
// product limit, not a physical "fits in 24 hours" calculation.
export const MAX_DAILY_PAPERS = 8;

export function includedPapers(level: DailyLevel) {
  return DAILY_PAPERS[level];
}

export function levelForPapers(count: number) {
  return levels[Math.min(Math.max(count, 1), levels.length) - 1];
}

export function mockMonthlyActive(plan: { plan: string; status: string; endsAt: Date | null } | null, now = new Date()) {
  return plan?.plan === "MOCK_MONTHLY" && plan.status === "ACTIVE" && !!plan.endsAt && plan.endsAt > now;
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
export function dailySchedule(
  day: Date,
  count: number,
  duration: number,
  papers: ScheduledPaper[],
  previousDaySubmission?: Date | null,
  startMinutes = 480,
) {
  const offset = (startMinutes - 330) * 60_000;
  const configuredStart = day.getTime() + offset;
  const carryOver = previousDaySubmission ? previousDaySubmission.getTime() + EXAM_BREAK_MINUTES * 60_000 : 0;
  let startsAt = new Date(Math.max(configuredStart, carryOver));
  return Array.from({ length: count }, (_, slot) => {
    const paper = papers.find((row) => row.slot === slot);
    const previous = papers.find((row) => row.slot === slot - 1);
    const available = startsAt.getTime() <= Date.now() && (slot === 0 || Boolean(previous?.submittedAt));
    const sitting = { slot, startsAt, available, status: paper?.status ?? "SCHEDULED" };
    const finish = paper?.submittedAt ?? paper?.attempt?.deadline
      ?? new Date(Math.max(Date.now(), startsAt.getTime()) + duration * 60_000);
    startsAt = new Date(finish.getTime() + EXAM_BREAK_MINUTES * 60_000);
    return sitting;
  });
}
