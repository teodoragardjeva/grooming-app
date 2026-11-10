// Pure availability engine: no I/O, no clock access (the caller passes `now`).
// All intervals are half-open [start, end). The database re-validates every booking
// (see db/migrations/*_booking_functions.sql); this module only LISTS candidate slots.
import { isoWeekdayOfDate, localDateTimeToUtc, STUDIO_TIMEZONE } from "../time/zone.ts";

export interface Interval {
  start: Date;
  end: Date;
}

export interface WeeklyHour {
  weekday: number; // ISO 1-7
  start: string; // "HH:MM"
  end: string;
}

export interface HourOverride {
  date: string; // "YYYY-MM-DD" studio-local
  isClosed: boolean;
  start?: string;
  end?: string;
}

export interface LocalWindow {
  start: string;
  end: string;
}

export interface ServiceTiming {
  durationMinutes: number;
  prepMinutes: number;
  cleanupMinutes: number;
}

export interface AvailabilitySettings {
  slotMinutes: number;
  minNoticeMinutes: number;
  horizonDays: number;
}

export type SlotReason = "too_soon" | "too_far" | "booked";

export interface Slot {
  /** Customer-visible procedure window. */
  start: Date;
  end: Date;
  /** Internal allocation including preparation and cleanup buffers. */
  allocStart: Date;
  allocEnd: Date;
  available: boolean;
  reason?: SlotReason;
}

/** Weekly schedule vs. date overrides: any override row for the date replaces the weekly hours. */
export function resolveWindows(
  date: string,
  weekly: WeeklyHour[],
  overrides: HourOverride[],
): LocalWindow[] {
  const forDate = overrides.filter((o) => o.date === date);
  if (forDate.length > 0) {
    return forDate
      .filter((o) => !o.isClosed && o.start && o.end)
      .map((o) => ({ start: o.start as string, end: o.end as string }));
  }
  const wd = isoWeekdayOfDate(date);
  return weekly.filter((w) => w.weekday === wd).map((w) => ({ start: w.start, end: w.end }));
}

const MIN = 60000;

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Candidate start times for one studio-local date. Starts are laid on a grid of
 * `slotMinutes` anchored at each window's opening. A start is listed when the procedure fits
 * inside the window; it is `available` only if the whole allocation (buffers included) avoids
 * blocked/busy intervals and it satisfies notice and horizon. Buffers may extend past the window's
 * opening/closing time: they only count between procedures.
 */
export function computeSlots(input: {
  date: string;
  timezone?: string;
  windows: LocalWindow[];
  blocked: Interval[];
  busy: Interval[];
  timing: ServiceTiming;
  settings: AvailabilitySettings;
  now: Date;
}): Slot[] {
  const tz = input.timezone ?? STUDIO_TIMEZONE;
  const { timing, settings, now } = input;
  const earliest = now.getTime() + settings.minNoticeMinutes * MIN;
  const latest = now.getTime() + settings.horizonDays * 24 * 60 * MIN;
  const occupied = [...input.blocked, ...input.busy];
  const slots: Slot[] = [];

  for (const w of input.windows) {
    const wStart = localDateTimeToUtc(input.date, w.start, tz);
    const wEnd = localDateTimeToUtc(input.date, w.end, tz);
    for (
      let t = wStart.getTime();
      t + timing.durationMinutes * MIN <= wEnd.getTime();
      t += settings.slotMinutes * MIN
    ) {
      const start = new Date(t);
      const end = new Date(t + timing.durationMinutes * MIN);
      const allocStart = new Date(t - timing.prepMinutes * MIN);
      const allocEnd = new Date(end.getTime() + timing.cleanupMinutes * MIN);
      const alloc = { start: allocStart, end: allocEnd };

      let reason: SlotReason | undefined;
      if (t < earliest) reason = "too_soon";
      else if (t > latest) reason = "too_far";
      else if (occupied.some((o) => overlaps(alloc, o))) reason = "booked";

      slots.push({ start, end, allocStart, allocEnd, available: reason === undefined, reason });
    }
  }
  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}
