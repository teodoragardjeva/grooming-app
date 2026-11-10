// Server-side slot listing. Inputs come from the database in one call; the pure engine computes slots.
import { computeSlots, resolveWindows, type Interval, type Slot } from "../availability/engine.ts";
import { addDays, dateRange, daysBetween, isValidDateString, localDateOf } from "../time/dates.ts";
import { localDateTimeToUtc } from "../time/zone.ts";
import { toBookingError, type BookingError } from "./errors.ts";
import { resolveResource, type BookingDeps } from "./deps.ts";

interface Inputs {
  ok: boolean;
  error?: string;
  settings: { timezone: string; currency: string; slot_minutes: number; min_notice_minutes: number; horizon_days: number };
  timing: { duration_minutes: number; price_cents: number; prep_minutes: number; cleanup_minutes: number };
  weekly: { weekday: number; start: string; end: string }[];
  overrides: { date: string; is_closed: boolean; start: string | null; end: string | null }[];
  blocked: { start: string; end: string }[];
  busy: { start: string; end: string }[];
}

export interface SlotDto {
  start: string;
  end: string;
  available: boolean;
  reason?: string;
}

export interface SlotsResult {
  ok: true;
  date: string;
  timezone: string;
  durationMinutes: number;
  priceCents: number;
  currency: string;
  slots: SlotDto[];
}

const toIv = (r: { start: string; end: string }): Interval => ({ start: new Date(r.start), end: new Date(r.end) });

async function loadInputs(deps: BookingDeps, serviceId: string, variantId: string | null, from: Date, to: Date): Promise<Inputs> {
  const resource = await resolveResource(deps);
  return deps.rpc<Inputs>("availability_inputs", {
    p_resource: resource,
    p_service: serviceId,
    p_variant: variantId,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
    p_now: deps.now().toISOString(),
  });
}

function slotsFor(inp: Inputs, date: string, now: Date): Slot[] {
  const windows = resolveWindows(
    date,
    inp.weekly,
    inp.overrides.map((o) => ({ date: o.date, isClosed: o.is_closed, start: o.start ?? undefined, end: o.end ?? undefined })),
  );
  return computeSlots({
    date,
    timezone: inp.settings.timezone,
    windows,
    blocked: inp.blocked.map(toIv),
    busy: inp.busy.map(toIv),
    timing: { durationMinutes: inp.timing.duration_minutes, prepMinutes: inp.timing.prep_minutes, cleanupMinutes: inp.timing.cleanup_minutes },
    settings: { slotMinutes: inp.settings.slot_minutes, minNoticeMinutes: inp.settings.min_notice_minutes, horizonDays: inp.settings.horizon_days },
    now,
  });
}

export async function listSlots(
  deps: BookingDeps,
  q: { serviceId: string; variantId: string | null; date: string },
): Promise<SlotsResult | { ok: false; error: BookingError }> {
  if (!isValidDateString(q.date)) return { ok: false, error: "invalid_input" };
  const now = deps.now();
  const inp = await loadInputs(deps, q.serviceId, q.variantId, localDateTimeToUtc(q.date, "00:00"), localDateTimeToUtc(addDays(q.date, 1), "00:00"));
  if (!inp.ok) return { ok: false, error: toBookingError(inp.error) };
  const slots = slotsFor(inp, q.date, now);
  return {
    ok: true,
    date: q.date,
    timezone: inp.settings.timezone,
    durationMinutes: inp.timing.duration_minutes,
    priceCents: inp.timing.price_cents,
    currency: inp.settings.currency,
    slots: slots.map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString(), available: s.available, reason: s.reason })),
  };
}

/** Dates (within [from, to], max 62 days) that have at least one bookable slot. */
export async function listAvailableDays(
  deps: BookingDeps,
  q: { serviceId: string; variantId: string | null; from: string; to: string },
): Promise<{ ok: true; days: string[] } | { ok: false; error: BookingError }> {
  if (!isValidDateString(q.from) || !isValidDateString(q.to) || q.to < q.from || daysBetween(q.from, q.to) > 62) {
    return { ok: false, error: "invalid_input" };
  }
  const now = deps.now();
  const inp = await loadInputs(deps, q.serviceId, q.variantId, localDateTimeToUtc(q.from, "00:00"), localDateTimeToUtc(addDays(q.to, 1), "00:00"));
  if (!inp.ok) return { ok: false, error: toBookingError(inp.error) };
  const days = dateRange(q.from, q.to).filter((d) => slotsFor(inp, d, now).some((s) => s.available));
  return { ok: true, days };
}

export { localDateOf };
