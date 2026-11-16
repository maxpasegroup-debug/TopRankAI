export const LEVEL_LABELS: Record<string, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  EXTREME: "Extreme",
};

export const LEVEL_DESCRIPTIONS: Record<string, string> = {
  BEGINNER: "Build the foundation with shorter, confidence-building papers.",
  INTERMEDIATE: "Balance learning with consistent exam-style practice.",
  ADVANCED: "Push speed and accuracy with harder mixed papers.",
  EXTREME: "Peak-intensity preparation for exam-day conditions.",
};

export const levelMinutes: Record<string, number> = {
  BEGINNER: 30,
  INTERMEDIATE: 45,
  ADVANCED: 90,
  EXTREME: 120,
};

export function levelLabel(level: string | null | undefined) {
  return LEVEL_LABELS[level ?? ""] ?? "Beginner";
}

export function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "bigint") return Number(value);
  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed : 0;
}

export function localDateKey(date: Date, timeZone = "Asia/Kolkata") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function dateFromKey(key: string) {
  return new Date(`${key}T00:00:00.000Z`);
}

export function todayDate(timeZone = "Asia/Kolkata") {
  return dateFromKey(localDateKey(new Date(), timeZone));
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function startOfDayUtc(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function daysBetween(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export function formatDate(date: Date | null | undefined, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", { ...options, timeZone: "Asia/Kolkata" }).format(date);
}

export function formatDateTime(date: Date | null | undefined) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(date);
}

export function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.max(0, seconds % 60);
  return `${minutes}m ${String(rest).padStart(2, "0")}s`;
}

export function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 1000) / 10;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function ageFromDate(dateOfBirth: Date) {
  const now = new Date();
  let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const month = now.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (month < 0 || (month === 0 && now.getUTCDate() < dateOfBirth.getUTCDate())) age -= 1;
  return age;
}

export function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  return `${name.slice(0, 2)}${"*".repeat(Math.max(1, name.length - 2))}@${domain}`;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function humanCategory(value: string | null | undefined) {
  return (value ?? "Other")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
