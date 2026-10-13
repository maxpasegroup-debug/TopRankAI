export function calendarDay(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = (name: string) => parts.find(part => part.type === name)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
export function shiftDay(day: string, offset: number) { const date = new Date(`${day}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + offset); return date.toISOString().slice(0, 10); }
export function recordedSessionMinutes(start: Date, end: Date) { return Math.max(0, Math.min(720, Math.floor((end.getTime() - start.getTime()) / 60000))); }
