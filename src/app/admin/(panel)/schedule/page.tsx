import Link from "next/link";
import { Flash, fieldCls } from "@/components/admin/flash";
import { CopyDayButton } from "@/components/admin/copy-day-button";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/admin/auth";
import { fmtDateTime } from "@/lib/admin/format";
import { S } from "@/lib/admin/strings";
import { localDateOf } from "@/lib/time/dates";
import { addBlockAction, confirmPendingAction, deleteBlockAction, deleteOverrideAction, saveOverrideAction, saveWeeklyAction } from "./actions";

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; pending?: string }> }) {
  const { db } = await requireAdmin();
  const sp = await searchParams;
  const today = localDateOf(new Date());
  const [wh, ov, bl] = await Promise.all([
    db.from("working_hours").select("weekday,start_time,end_time").order("weekday").order("start_time"),
    db.from("working_hour_overrides").select("id,on_date,is_closed,start_time,end_time,note").gte("on_date", today).order("on_date"),
    db.from("blocked_intervals").select("id,start_at,end_at,reason").gte("end_at", new Date().toISOString()).order("start_at"),
  ]);
  const byDay = (d: number) => (wh.data ?? []).filter((w) => w.weekday === d);

  let pending: { kind: string; list: { id: string; s: string; n: string }[] } | null = null;
  if (sp.pending) { try { pending = JSON.parse(Buffer.from(sp.pending, "base64url").toString()); } catch { pending = null; } }

  return (
    <div className="space-y-10">
      <h1 className="text-3xl text-heading">{S.sched.title}</h1>
      <Flash ok={sp.ok} err={sp.err} />

      {pending && (
        <section role="alert" className="rounded-xl border-2 border-red-700 bg-red-50 p-4">
          <h2 className="text-xl text-red-900">{S.sched.conflictTitle}</h2>
          <p className="mt-1">{S.sched.conflictHelp}</p>
          <ul className="mt-2 list-disc pl-5">
            {pending.list.map((c) => <li key={c.id}><Link className="underline" href={`/admin/appointments/${c.id}`}>{fmtDateTime(c.s)} – {c.n}</Link></li>)}
          </ul>
          <form action={confirmPendingAction} className="mt-3 space-y-2">
            <input type="hidden" name="pending" value={sp.pending} />
            <label className="flex items-center gap-2 font-semibold"><input type="checkbox" name="confirm" value="yes" required className="size-5" /> {S.sched.conflictConfirm}</label>
            <SubmitButton variant="outlineLight" className="border-red-800 text-red-900">{S.common.save}</SubmitButton>
          </form>
        </section>
      )}

      <section aria-labelledby="weekly">
        <h2 id="weekly" className="text-2xl text-heading">{S.sched.weekly}</h2>
        <p className="mt-1 text-sm">{S.sched.weeklyHelp}</p>
        <form action={saveWeeklyAction} className="mt-3">
          <div className="overflow-hidden rounded-xl border border-heading/20 bg-white/60">
            <div className="hidden bg-wine px-4 py-2 text-sm font-semibold text-gold-100 sm:grid sm:grid-cols-[9rem_repeat(3,minmax(0,1fr))] sm:gap-4" aria-hidden="true">
              <span>{S.sched.day}</span>
              {[1, 2, 3].map((k) => <span key={k}>{S.sched.period} {k} <span className="font-normal text-mist">({S.sched.from} – {S.sched.to})</span></span>)}
            </div>
            <ul className="divide-y divide-heading/15">
              {S.sched.weekdays.map((name, i) => {
                const d = i + 1, rows = byDay(d);
                return (
                  <li key={d} className="grid gap-2 px-4 py-3 sm:grid-cols-[9rem_repeat(3,minmax(0,1fr))] sm:items-center sm:gap-4">
                    <div>
                      <span className="font-semibold text-heading">{name}{rows.length === 0 && <span className="ml-2 rounded-full bg-heading/10 px-2 py-0.5 text-xs font-normal">{S.sched.closed}</span>}</span>
                      {d < 7 && <div><CopyDayButton from={d} to={d + 1} label={S.sched.copyNext} doneLabel={S.sched.copied} ariaLabel={S.sched.copyAria.replace("{from}", name).replace("{to}", S.sched.weekdays[d] ?? "")} /></div>}
                    </div>
                    {[0, 1, 2].map((k) => (
                      <div key={k}>
                        <span className="text-xs font-semibold text-heading/80 sm:hidden">{S.sched.period} {k + 1}</span>
                        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                          <label className="sr-only" htmlFor={`w${d}_${k}_start`}>{name}: {S.sched.period} {k + 1}, {S.sched.from}</label>
                          <input id={`w${d}_${k}_start`} name={`w${d}_${k}_start`} type="time" defaultValue={rows[k]?.start_time.slice(0, 5) ?? ""} className={`${fieldCls} !mt-0 min-w-0 !px-2`} />
                          <span aria-hidden="true">–</span>
                          <label className="sr-only" htmlFor={`w${d}_${k}_end`}>{name}: {S.sched.period} {k + 1}, {S.sched.to}</label>
                          <input id={`w${d}_${k}_end`} name={`w${d}_${k}_end`} type="time" defaultValue={rows[k]?.end_time.slice(0, 5) ?? ""} className={`${fieldCls} !mt-0 min-w-0 !px-2`} />
                        </div>
                      </div>
                    ))}
                  </li>
                );
              })}
            </ul>
          </div>
          <SubmitButton className="mt-4">{S.sched.saveWeekly}</SubmitButton>
        </form>
      </section>

      <section aria-labelledby="ovr">
        <h2 id="ovr" className="text-2xl text-heading">{S.sched.overrides}</h2>
        <form action={saveOverrideAction} className="mt-3 grid gap-3 sm:grid-cols-2">
          <div><label htmlFor="o-from">{S.sched.dateFrom}</label><input id="o-from" name="from" type="date" required min={today} className={fieldCls} /></div>
          <div><label htmlFor="o-to">{S.sched.dateTo}</label><input id="o-to" name="to" type="date" min={today} className={fieldCls} /></div>
          <fieldset className="sm:col-span-2"><legend className="sr-only">Тип</legend>
            <label className="mr-4"><input type="radio" name="mode" value="closed" defaultChecked /> {S.sched.closedRange}</label>
            <label><input type="radio" name="mode" value="special" /> {S.sched.special}</label></fieldset>
          <div><label htmlFor="o-start">{S.sched.from}</label><input id="o-start" name="start" type="time" className={fieldCls} /></div>
          <div><label htmlFor="o-end">{S.sched.to}</label><input id="o-end" name="end" type="time" className={fieldCls} /></div>
          <div className="sm:col-span-2"><label htmlFor="o-note">{S.sched.note}</label><input id="o-note" name="note" maxLength={200} className={fieldCls} /></div>
          <div><SubmitButton>{S.sched.addOverride}</SubmitButton></div>
        </form>
        <ul className="mt-4 space-y-2">
          {(ov.data ?? []).map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-3">
              <span>{o.on_date} – {o.is_closed ? S.sched.closedRange : `${o.start_time?.slice(0, 5)}–${o.end_time?.slice(0, 5)}`}{o.note ? ` (${o.note})` : ""}</span>
              <form action={deleteOverrideAction}><input type="hidden" name="id" value={o.id} /><SubmitButton size="sm" variant="outlineLight">{S.sched.remove}</SubmitButton></form>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="blk">
        <h2 id="blk" className="text-2xl text-heading">{S.sched.blocks}</h2>
        <form action={addBlockAction} className="mt-3 grid gap-3 sm:grid-cols-2">
          <div><label htmlFor="b-start">{S.sched.blockStart}</label><input id="b-start" name="start" type="datetime-local" required className={fieldCls} /></div>
          <div><label htmlFor="b-end">{S.sched.blockEnd}</label><input id="b-end" name="end" type="datetime-local" required className={fieldCls} /></div>
          <div className="sm:col-span-2"><label htmlFor="b-reason">{S.sched.reason}</label><input id="b-reason" name="reason" maxLength={200} className={fieldCls} /></div>
          <div><SubmitButton>{S.sched.addBlock}</SubmitButton></div>
        </form>
        <ul className="mt-4 space-y-2">
          {(bl.data ?? []).map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-3">
              <span>{fmtDateTime(b.start_at)} – {fmtDateTime(b.end_at)}{b.reason ? ` (${b.reason})` : ""}</span>
              <form action={deleteBlockAction}><input type="hidden" name="id" value={b.id} /><SubmitButton size="sm" variant="outlineLight">{S.sched.remove}</SubmitButton></form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
