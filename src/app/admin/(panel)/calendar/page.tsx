import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { loadCalendar, windowsFor, type CalData } from "@/lib/admin/calendar-data";
import { fmtDay, fmtDayShort, fmtTime } from "@/lib/admin/format";
import { S } from "@/lib/admin/strings";
import { addDays, isValidDateString, localDateOf, startOfIsoWeek } from "@/lib/time/dates";
import { isoWeekdayOfDate, localDateTimeToUtc } from "@/lib/time/zone";

type View = "day" | "week" | "month";
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const minOfDay = (iso: string, date: string) => Math.round((new Date(iso).getTime() - localDateTimeToUtc(date, "00:00").getTime()) / 60000);
const tone = (s: string) => s === "pending_confirmation" ? "border-dashed border-gold-600 bg-gold-400/30" : s === "confirmed" ? "border-burgundy-700 bg-burgundy-700 text-parchment-50" : "border-burgundy-800/40 bg-parchment-200";
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string }> }) {
  const { db } = await requireAdmin();
  const sp = await searchParams;
  const today = localDateOf(new Date());
  const date = sp.date && isValidDateString(sp.date) ? sp.date : today;
  const view: View = sp.view === "week" || sp.view === "month" ? sp.view : "day";

  const first = view === "day" ? date : view === "week" ? startOfIsoWeek(date) : `${date.slice(0, 7)}-01`;
  const monthEnd = (() => { const d = new Date(`${date.slice(0, 7)}-01T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1, 0); return d.toISOString().slice(0, 10); })();
  const last = view === "day" ? date : view === "week" ? addDays(first, 6) : monthEnd;
  const gridStart = view === "month" ? startOfIsoWeek(first) : first;
  const data = await loadCalendar(db, gridStart, view === "month" ? addDays(startOfIsoWeek(monthEnd), 6) : last);

  const step = view === "day" ? 1 : 7;
  const prev = view === "month" ? `${addDays(first, -1).slice(0, 7)}-01` : addDays(date, -step);
  const next = view === "month" ? addDays(monthEnd, 1) : addDays(date, step);
  const q = (d: string, v: View = view) => `/admin/calendar?view=${v}&date=${d}`;
  const btn = "inline-flex min-h-11 items-center rounded-full bg-parchment-200 px-4 focus-visible:outline-2 focus-visible:outline-gold-500";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl text-heading">{S.nav.calendar}</h1>
        <nav aria-label="Изглед" className="flex gap-1">
          {(["day", "week", "month"] as View[]).map((v) => (
            <Link key={v} href={q(date, v)} aria-current={v === view ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-full px-4 ${v === view ? "bg-burgundy-800 text-parchment-50" : "bg-parchment-200"}`}>{S.cal[v]}</Link>
          ))}
        </nav>
        <nav aria-label="Навигация по дати" className="ml-auto flex gap-1">
          <Link href={q(prev)} className={btn}>← {S.cal.prev}</Link>
          <Link href={q(today)} className={btn}>{S.cal.today}</Link>
          <Link href={q(next)} className={btn}>{S.cal.next} →</Link>
        </nav>
      </div>
      <p className="mt-2 text-lg">{view === "day" ? fmtDay(date) : view === "week" ? `${fmtDayShort(first)} – ${fmtDayShort(last)}` : new Intl.DateTimeFormat("bg-BG", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${first}T12:00:00Z`))}</p>
      <Legend />
      {view === "day" && <DayView date={date} data={data} />}
      {view === "week" && <WeekView first={first} data={data} today={today} />}
      {view === "month" && <MonthView first={first} gridStart={gridStart} monthEnd={monthEnd} data={data} today={today} />}
    </div>
  );
}

function Legend() {
  return (
    <ul className="mt-3 flex flex-wrap gap-3 text-sm">
      <li className="rounded border-2 border-burgundy-700 bg-burgundy-700 px-2 text-parchment-50">{S.status.confirmed}</li>
      <li className="rounded border-2 border-dashed border-gold-600 bg-gold-400/30 px-2">{S.status.pending_confirmation}</li>
      <li className="rounded border-2 border-burgundy-800/40 bg-parchment-200 px-2">{S.status.completed} / {S.status.no_show}</li>
      <li className="rounded bg-burgundy-900/10 px-2">{S.cal.buffer}</li>
      <li className="rounded bg-red-200 px-2">{S.cal.blocked}</li>
    </ul>
  );
}

function DayView({ date, data }: { date: string; data: CalData }) {
  const wins = windowsFor(data, date, isoWeekdayOfDate(date));
  const dayAppts = data.appts.filter((a) => minOfDay(a.start_at, date) >= 0 && minOfDay(a.start_at, date) < 1440);
  const mins = [...wins.flatMap((w) => [toMin(w.start), toMin(w.end)]), ...dayAppts.flatMap((a) => [minOfDay(a.start_at, date) - a.prep_buffer_minutes, minOfDay(a.end_at, date) + a.cleanup_buffer_minutes])];
  const from = Math.max(0, Math.floor((mins.length ? Math.min(...mins) : 9 * 60) / 60) * 60);
  const to = Math.min(1440, Math.ceil((mins.length ? Math.max(...mins) : 19 * 60) / 60) * 60);
  const PX = 1.2; // px per minute
  const hours = Array.from({ length: (to - from) / 60 + 1 }, (_, i) => from + i * 60);
  return (
    <div className="mt-4 overflow-x-auto">
      {wins.length === 0 && <p className="mb-2 rounded bg-parchment-200 p-2">{S.cal.closed}</p>}
      <div className="relative ml-14 rounded-xl border border-burgundy-800/20 bg-white" style={{ height: (to - from) * PX }}>
        {hours.map((h) => (
          <div key={h} className="absolute left-0 right-0 border-t border-burgundy-800/10" style={{ top: (h - from) * PX }}>
            <span className="absolute -left-14 -top-2.5 w-12 text-right text-xs">{hhmm(h)}</span>
          </div>
        ))}
        {wins.length > 0 && <ClosedShade wins={wins} from={from} to={to} px={PX} />}
        {wins.flatMap((w) => Array.from({ length: Math.floor((toMin(w.end) - toMin(w.start)) / 60) }, (_, i) => toMin(w.start) + i * 60)).map((m) => (
          <Link key={m} aria-label={`${S.cal.newHere} ${hhmm(m)}`} href={`/admin/appointments/new?date=${date}&time=${hhmm(m)}`} className="absolute left-0 right-0 z-0 hover:bg-gold-400/20 focus-visible:outline-2 focus-visible:outline-gold-500" style={{ top: (m - from) * PX, height: 60 * PX }} />
        ))}
        {data.blocks.map((b) => {
          const s = Math.max(minOfDay(b.start_at, date), from), e = Math.min(minOfDay(b.end_at, date), to);
          return e > s ? <div key={b.id} className="pointer-events-none absolute left-0 right-0 z-10 bg-red-200/80 px-2 text-sm" style={{ top: (s - from) * PX, height: (e - s) * PX }}>{S.cal.blocked}{b.reason ? `: ${b.reason}` : ""}</div> : null;
        })}
        {dayAppts.map((a) => {
          const s = minOfDay(a.start_at, date), e = minOfDay(a.end_at, date);
          return (
            <div key={a.id}>
              {a.prep_buffer_minutes > 0 && <div aria-hidden="true" className="pointer-events-none absolute left-1 right-1 z-10 rounded-t bg-burgundy-900/10" style={{ top: (s - a.prep_buffer_minutes - from) * PX, height: a.prep_buffer_minutes * PX }} />}
              {a.cleanup_buffer_minutes > 0 && <div aria-hidden="true" className="pointer-events-none absolute left-1 right-1 z-10 rounded-b bg-burgundy-900/10" style={{ top: (e - from) * PX, height: a.cleanup_buffer_minutes * PX }} />}
              <Link href={`/admin/appointments/${a.id}`} className={`absolute left-1 right-1 z-20 overflow-hidden rounded border-2 px-2 py-0.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 ${tone(a.status)}`} style={{ top: (s - from) * PX, height: Math.max((e - s) * PX, 18) }}>
                <strong>{fmtTime(a.start_at)}–{fmtTime(a.end_at)}</strong> {a.customer_name}{a.dog_name ? ` (${a.dog_name})` : ""} · {a.service_name_bg}{a.variant_label_bg ? ` · ${a.variant_label_bg}` : ""}
                <span className="sr-only"> – {S.status[a.status]}</span>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ClosedShade({ wins, from, to, px }: { wins: { start: string; end: string }[]; from: number; to: number; px: number }) {
  const sorted = [...wins].sort((a, b) => toMin(a.start) - toMin(b.start));
  const gaps: [number, number][] = [];
  let cur = from;
  for (const w of sorted) { if (toMin(w.start) > cur) gaps.push([cur, toMin(w.start)]); cur = Math.max(cur, toMin(w.end)); }
  if (cur < to) gaps.push([cur, to]);
  return <>{gaps.map(([s, e]) => <div key={s} aria-hidden="true" className="pointer-events-none absolute left-0 right-0 bg-parchment-200/70" style={{ top: (s - from) * px, height: (e - s) * px }} />)}</>;
}

function WeekView({ first, data, today }: { first: string; data: CalData; today: string }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(first, i));
  const PX = 1.1; // px per minute
  const info = days.map((d) => {
    const wins = windowsFor(data, d, isoWeekdayOfDate(d));
    const appts = data.appts.filter((a) => minOfDay(a.start_at, d) >= 0 && minOfDay(a.start_at, d) < 1440);
    return { d, wins, appts };
  });
  const mins = info.flatMap(({ d, wins, appts }) => [
    ...wins.flatMap((w) => [toMin(w.start), toMin(w.end)]),
    ...appts.flatMap((a) => [minOfDay(a.start_at, d) - a.prep_buffer_minutes, minOfDay(a.end_at, d) + a.cleanup_buffer_minutes]),
  ]);
  const from = Math.max(0, Math.floor((mins.length ? Math.min(...mins) : 9 * 60) / 60) * 60);
  const to = Math.min(1440, Math.ceil((mins.length ? Math.max(...mins) : 19 * 60) / 60) * 60);
  const hours = Array.from({ length: (to - from) / 60 }, (_, i) => from + i * 60);
  const height = (to - from) * PX;
  const cols = { gridTemplateColumns: "3.5rem repeat(7, minmax(0, 1fr))" };
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-burgundy-800/30 bg-white shadow-sm">
      <div className="min-w-[880px]">
        <div className="grid border-b border-burgundy-800/30 bg-parchment-100" style={cols}>
          <div aria-hidden="true" />
          {info.map(({ d, wins }) => (
            <Link key={d} href={`/admin/calendar?view=day&date=${d}`} className={`border-l border-burgundy-800/20 px-2 py-2 text-center text-sm font-bold hover:bg-gold-400/20 focus-visible:outline-2 focus-visible:outline-gold-500 ${d === today ? "bg-gold-400/30" : ""}`}>
              {fmtDayShort(d)}
              {wins.length === 0 && <span className="block text-xs font-normal">{S.cal.closed}</span>}
            </Link>
          ))}
        </div>
        <div className="grid" style={cols}>
          <div aria-hidden="true" className="relative" style={{ height }}>
            {hours.map((h) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-xs text-burgundy-900/80" style={{ top: (h - from) * PX + (h === from ? 8 : 0) }}>{hhmm(h)}</span>
            ))}
          </div>
          {info.map(({ d, wins, appts }) => (
            <div key={d} className={`relative border-l border-burgundy-800/20 ${d === today ? "bg-gold-400/10" : ""}`} style={{ height }}>
              {hours.map((h) => (
                <div key={h} aria-hidden="true" className="pointer-events-none absolute left-0 right-0 border-t border-burgundy-800/15" style={{ top: (h - from) * PX }} />
              ))}
              <ClosedShade wins={wins} from={from} to={to} px={PX} />
              {wins.flatMap((w) => Array.from({ length: Math.floor((toMin(w.end) - toMin(w.start)) / 60) }, (_, i) => toMin(w.start) + i * 60)).map((m) => (
                <Link key={m} aria-label={`${S.cal.newHere} ${fmtDayShort(d)} ${hhmm(m)}`} href={`/admin/appointments/new?date=${d}&time=${hhmm(m)}`} className="absolute left-0 right-0 z-0 hover:bg-gold-400/20 focus-visible:outline-2 focus-visible:outline-gold-500" style={{ top: (m - from) * PX, height: 60 * PX }} />
              ))}
              {data.blocks.map((b) => {
                const bs = Math.max(minOfDay(b.start_at, d), from), be = Math.min(minOfDay(b.end_at, d), to);
                return be > bs ? <div key={b.id} className="pointer-events-none absolute left-0 right-0 z-10 overflow-hidden bg-red-200/80 px-1 text-xs" style={{ top: (bs - from) * PX, height: (be - bs) * PX }}>{S.cal.blocked}</div> : null;
              })}
              {appts.map((a) => {
                const st = minOfDay(a.start_at, d), en = minOfDay(a.end_at, d);
                const h = Math.max((en - st) * PX, 20);
                return (
                  <div key={a.id}>
                    {a.prep_buffer_minutes > 0 && <div aria-hidden="true" className="pointer-events-none absolute left-0.5 right-0.5 z-10 rounded-t bg-burgundy-900/10" style={{ top: (st - a.prep_buffer_minutes - from) * PX, height: a.prep_buffer_minutes * PX }} />}
                    {a.cleanup_buffer_minutes > 0 && <div aria-hidden="true" className="pointer-events-none absolute left-0.5 right-0.5 z-10 rounded-b bg-burgundy-900/10" style={{ top: (en - from) * PX, height: a.cleanup_buffer_minutes * PX }} />}
                    <Link
                      href={`/admin/appointments/${a.id}`}
                      title={`${fmtTime(a.start_at)}–${fmtTime(a.end_at)} ${a.customer_name}${a.dog_name ? ` (${a.dog_name})` : ""} · ${a.service_name_bg}`}
                      className={`absolute left-0.5 right-0.5 z-20 overflow-hidden rounded border-2 px-1.5 py-0.5 text-xs leading-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 ${tone(a.status)}`}
                      style={{ top: (st - from) * PX, height: h }}
                    >
                      <strong>{fmtTime(a.start_at)}</strong> {a.customer_name}
                      {h >= 44 && <span className="block truncate">{a.service_name_bg}{a.variant_label_bg ? ` · ${a.variant_label_bg}` : ""}</span>}
                      <span className="sr-only"> – {S.status[a.status]}</span>
                    </Link>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MonthView({ first, gridStart, monthEnd, data, today }: { first: string; gridStart: string; monthEnd: string; data: CalData; today: string }) {
  const weeks = Math.ceil((Math.round((new Date(`${addDays(startOfIsoWeek(monthEnd), 6)}T12:00:00Z`).getTime() - new Date(`${gridStart}T12:00:00Z`).getTime()) / 86400000) + 1) / 7);
  const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i));
  return (
    <div className="mt-4">
      <div className="grid grid-cols-7 gap-1 text-center text-sm font-bold">{S.cal.weekdays.map((w) => <div key={w}>{w}</div>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((d) => {
          const inMonth = d.slice(0, 7) === first.slice(0, 7);
          const n = data.appts.filter((a) => minOfDay(a.start_at, d) >= 0 && minOfDay(a.start_at, d) < 1440).length;
          return (
            <Link key={d} href={`/admin/calendar?view=day&date=${d}`} className={`min-h-16 rounded-lg border p-1 text-sm focus-visible:outline-2 focus-visible:outline-gold-500 ${inMonth ? "bg-white" : "bg-parchment-100 opacity-60"} ${d === today ? "border-gold-600" : "border-burgundy-800/20"}`}>
              <span className="font-bold">{Number(d.slice(8))}</span>
              {n > 0 && <span className="mt-1 block rounded bg-burgundy-700 px-1 text-xs text-parchment-50">{n} ч.</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
