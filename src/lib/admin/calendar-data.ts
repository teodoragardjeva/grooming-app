import type { Db } from "../db/client.ts";
import { addDays } from "../time/dates.ts";
import { localDateTimeToUtc } from "../time/zone.ts";

export interface CalAppt {
  id: string; status: string; start_at: string; end_at: string; customer_name: string; dog_name: string | null;
  service_name_bg: string; variant_label_bg: string | null; prep_buffer_minutes: number; cleanup_buffer_minutes: number; source: string;
}
export interface CalBlock { id: string; start_at: string; end_at: string; reason: string | null }
export interface CalData {
  appts: CalAppt[]; blocks: CalBlock[];
  weekly: { weekday: number; start_time: string; end_time: string }[];
  overrides: { on_date: string; is_closed: boolean; start_time: string | null; end_time: string | null; note: string | null }[];
}

/** Reads (as the signed-in admin, RLS) everything the calendar views need for local dates [from, toInclusive]. */
export async function loadCalendar(db: Db, from: string, toInclusive: string): Promise<CalData> {
  const a = localDateTimeToUtc(from, "00:00").toISOString();
  const b = localDateTimeToUtc(addDays(toInclusive, 1), "00:00").toISOString();
  const [appts, blocks, weekly, overrides] = await Promise.all([
    db.from("appointments")
      .select("id,status,start_at,end_at,customer_name,dog_name,service_name_bg,variant_label_bg,prep_buffer_minutes,cleanup_buffer_minutes,source")
      .in("status", ["pending_confirmation", "confirmed", "completed", "no_show"]).gte("start_at", a).lt("start_at", b).order("start_at"),
    db.from("blocked_intervals").select("id,start_at,end_at,reason").lt("start_at", b).gt("end_at", a).order("start_at"),
    db.from("working_hours").select("weekday,start_time,end_time").order("weekday").order("start_time"),
    db.from("working_hour_overrides").select("on_date,is_closed,start_time,end_time,note").gte("on_date", from).lte("on_date", toInclusive),
  ]);
  return {
    appts: (appts.data ?? []) as CalAppt[],
    blocks: (blocks.data ?? []) as CalBlock[],
    weekly: (weekly.data ?? []) as CalData["weekly"],
    overrides: (overrides.data ?? []) as CalData["overrides"],
  };
}

/** Open windows (HH:MM pairs) for a local date: overrides replace the weekly schedule. */
export function windowsFor(data: CalData, date: string, isoWeekday: number): { start: string; end: string }[] {
  const ov = data.overrides.filter((o) => o.on_date === date);
  if (ov.length > 0) return ov.filter((o) => !o.is_closed && o.start_time && o.end_time).map((o) => ({ start: o.start_time!.slice(0, 5), end: o.end_time!.slice(0, 5) }));
  return data.weekly.filter((w) => w.weekday === isoWeekday).map((w) => ({ start: w.start_time.slice(0, 5), end: w.end_time.slice(0, 5) }));
}
