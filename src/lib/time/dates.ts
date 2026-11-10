// Calendar-date helpers on "YYYY-MM-DD" strings (studio-local dates). Erasable TS only.
import { localParts, STUDIO_TIMEZONE } from "./zone.ts";

export function isValidDateString(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const f = Date.parse(`${from}T00:00:00Z`);
  const t = Date.parse(`${to}T00:00:00Z`);
  return Math.round((t - f) / 86400000);
}

export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** The studio-local calendar date of an instant. */
export function localDateOf(at: Date, tz: string = STUDIO_TIMEZONE): string {
  const p = localParts(at, tz);
  return `${String(p.year).padStart(4, "0")}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** "HH:MM" studio-local time of an instant. */
export function localTimeOf(at: Date, tz: string = STUDIO_TIMEZONE): string {
  const p = localParts(at, tz);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

/** Monday of the ISO week containing `date`. */
export function startOfIsoWeek(date: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const wd = ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7); // Mon=0
  return addDays(date, -wd);
}
