// Dependency-free, DST-correct time-zone helpers (Intl based). Default studio zone: Europe/Sofia.
// Only erasable TypeScript syntax is used so Node can run this directly (type stripping).

export const STUDIO_TIMEZONE = "Europe/Sofia";

export interface LocalParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  isoWeekday: number; // 1 = Monday ... 7 = Sunday
}

/** Offset (minutes east of UTC) of `tz` at the instant `at`. */
export function tzOffsetMinutes(at: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(at)) p[part.type] = part.value;
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  const atSeconds = Math.floor(at.getTime() / 1000) * 1000;
  return Math.round((asUtc - atSeconds) / 60000);
}

/** Wall-clock parts of an instant in `tz`. */
export function localParts(at: Date, tz: string = STUDIO_TIMEZONE): LocalParts {
  const shifted = new Date(at.getTime() + tzOffsetMinutes(at, tz) * 60000);
  const dow = shifted.getUTCDay(); // 0 = Sunday
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    isoWeekday: dow === 0 ? 7 : dow,
  };
}

/** Converts a wall-clock time in `tz` to a UTC instant (DST-aware). */
export function zonedTimeToUtc(
  year: number, month: number, day: number, hour: number, minute: number,
  tz: string = STUDIO_TIMEZONE,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  const off1 = tzOffsetMinutes(new Date(naive), tz);
  let utc = naive - off1 * 60000;
  const off2 = tzOffsetMinutes(new Date(utc), tz);
  if (off2 !== off1) utc = naive - off2 * 60000;
  return new Date(utc);
}

/** "YYYY-MM-DD" -> ISO weekday (1 = Monday). Calendar arithmetic, zone independent. */
export function isoWeekdayOfDate(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 ? 7 : dow;
}

/** "HH:MM" on local date "YYYY-MM-DD" -> UTC instant. */
export function localDateTimeToUtc(date: string, hhmm: string, tz: string = STUDIO_TIMEZONE): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  return zonedTimeToUtc(y, m, d, h, mi, tz);
}

/**
 * Latest instant a customer may self-cancel: appointment start minus `hours`, measured on the
 * studio's wall clock (Friday 15:00 -> Thursday 15:00 local, even across a DST change).
 */
export function cancellationDeadline(start: Date, hours: number, tz: string = STUDIO_TIMEZONE): Date {
  const p = localParts(start, tz);
  const naive = new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - hours * 3600000);
  return zonedTimeToUtc(
    naive.getUTCFullYear(), naive.getUTCMonth() + 1, naive.getUTCDate(),
    naive.getUTCHours(), naive.getUTCMinutes(), tz,
  );
}
