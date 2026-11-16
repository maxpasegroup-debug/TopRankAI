import { afterEach, expect, it, vi } from "vitest";
import { dailySchedule, includedPapers, levelForPapers, mockMonthlyActive, paperCount } from "@/shared/daily-workload";

afterEach(() => vi.useRealTimers());
it("assigns a distinct workload to each level and restores the allowance at expiry", () => {
  expect([1, 2, 3, 4, 6].map(levelForPapers)).toEqual(["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXTREME", "EXTREME"]);
  expect(includedPapers("EXTREME")).toBe(4);
  const endsAt = new Date("2026-12-01T10:00Z");
  const sub = { plan: "MOCK_MONTHLY", status: "ACTIVE", endsAt };
  expect(paperCount("BEGINNER", 3, mockMonthlyActive(sub, new Date(endsAt.getTime() - 1)))).toBe(3);
  expect(paperCount("BEGINNER", 3, mockMonthlyActive(sub, endsAt))).toBe(1);
  expect(paperCount("ADVANCED", null, false)).toBe(3);
  expect(paperCount("ADVANCED", 2, false)).toBe(2);
});

it("opens the next sitting only after submission and a full break", () => {
  const day = new Date("2026-11-16T00:00Z");
  const submittedAt = new Date("2026-11-16T09:00Z");
  const papers = [{ slot: 0, status: "SUBMITTED", submittedAt, attempt: null }];
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-16T09:44:59Z"));
  const second = dailySchedule(day, 3, 180, papers)[1];
  expect(second.startsAt.toISOString()).toBe("2026-11-16T09:45:00.000Z");
  expect(second.available).toBe(false);
  vi.advanceTimersByTime(1000);
  expect(dailySchedule(day, 3, 180, papers).map((row) => row.available)).toEqual([true, true, false]);
  expect(dailySchedule(day, 3, 180, [])[1].available).toBe(false);
});

it("carries a late submission break across the Indian study-day boundary", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-16T18:35:00Z"));
  const schedule = dailySchedule(new Date("2026-11-17T00:00:00Z"), 2, 180, [], new Date("2026-11-16T18:20:00Z"), 0);
  expect(schedule[0].available).toBe(false);
  expect(schedule[0].startsAt.toISOString()).toBe("2026-11-16T19:05:00.000Z");
});

it("honours a candidate's IST start time", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-16T03:00:00Z"));
  const schedule = dailySchedule(new Date("2026-11-16T00:00:00Z"), 1, 180, [], null, 600);
  expect(schedule[0].startsAt.toISOString()).toBe("2026-11-16T04:30:00.000Z");
  expect(schedule[0].available).toBe(false);
});
