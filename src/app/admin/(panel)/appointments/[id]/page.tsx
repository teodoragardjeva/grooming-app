import { notFound } from "next/navigation";
import { Flash, fieldCls } from "@/components/admin/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/admin/auth";
import { fmtDateTime, fmtMoney } from "@/lib/admin/format";
import { S } from "@/lib/admin/strings";
import { localDateOf, localTimeOf } from "@/lib/time/dates";
import { cancelAppointmentAction, rescheduleAppointmentAction, saveNotesAction, setStatusAction } from "../actions";

export default async function AppointmentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { db } = await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: a } = await db.from("appointments").select("*").eq("id", id).maybeSingle();
  if (!a) notFound();
  const { data: history } = await db.from("audit_logs").select("id,action,created_at,new_data").eq("table_name", "appointments").eq("row_id", id).order("created_at", { ascending: false }).limit(30);
  const active = ["pending_confirmation", "confirmed"].includes(a.status);
  const dl = "grid grid-cols-[10rem_1fr] gap-y-1";
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl text-heading">{S.appt.detail}</h1>
      <Flash ok={sp.ok} err={sp.err} />
      <dl className={`mt-4 ${dl} rounded-xl bg-parchment-100 p-4`}>
        <dt className="font-semibold">Статус</dt><dd>{S.status[a.status] ?? a.status}</dd>
        <dt className="font-semibold">{S.appt.when}</dt><dd>{fmtDateTime(a.start_at)} – {fmtDateTime(a.end_at)} ({a.duration_minutes} мин.)</dd>
        <dt className="font-semibold">{S.appt.service}</dt><dd>{a.service_name_bg}{a.variant_label_bg ? ` – ${a.variant_label_bg}` : ""}</dd>
        <dt className="font-semibold">{S.appt.price}</dt><dd>{fmtMoney(a.price_cents, a.currency)}</dd>
        <dt className="font-semibold">{S.appt.name}</dt><dd>{a.customer_name}</dd>
        <dt className="font-semibold">{S.appt.phone}</dt><dd>{a.customer_phone ? <a className="underline" href={`tel:${a.customer_phone}`}>{a.customer_phone}</a> : "–"}</dd>
        <dt className="font-semibold">{S.appt.email}</dt><dd>{a.customer_email ?? "–"}</dd>
        <dt className="font-semibold">{S.appt.dog}</dt><dd>{a.dog_name ?? "–"}</dd>
        <dt className="font-semibold">{S.appt.notes}</dt><dd className="whitespace-pre-line">{a.notes ?? "–"}</dd>
        <dt className="font-semibold">{S.appt.source}</dt><dd>{a.source === "admin" ? S.appt.sourceAdmin : S.appt.sourcePublic}</dd>
        {a.cancellation_reason && (<><dt className="font-semibold">{S.appt.reason}</dt><dd>{a.cancellation_reason}</dd></>)}
      </dl>

      <form action={saveNotesAction} className="mt-6">
        <input type="hidden" name="id" value={a.id} />
        <label htmlFor="adminNotes" className="font-semibold">{S.appt.adminNotes}</label>
        <textarea id="adminNotes" name="adminNotes" rows={3} defaultValue={a.admin_notes ?? ""} className={fieldCls} />
        <SubmitButton variant="outlineLight" size="sm" className="mt-2">{S.appt.saveNotes}</SubmitButton>
      </form>

      {a.status === "confirmed" && new Date(a.start_at) < new Date() && (
        <div className="mt-6 flex flex-wrap gap-2">
          {(["completed", "no_show"] as const).map((st) => (
            <form key={st} action={setStatusAction}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value={st} />
              <SubmitButton variant="outlineLight">{st === "completed" ? S.appt.markCompleted : S.appt.markNoShow}</SubmitButton></form>
          ))}
        </div>
      )}

      {active && (
        <>
          <section aria-labelledby="resch" className="mt-8 rounded-xl border border-burgundy-800/20 p-4">
            <h2 id="resch" className="text-2xl text-heading">{S.appt.rescheduleTitle}</h2>
            <form action={rescheduleAppointmentAction} className="mt-3 space-y-3">
              <input type="hidden" name="id" value={a.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label htmlFor="r-date">{S.appt.date}</label><input id="r-date" name="date" type="date" required defaultValue={localDateOf(new Date(a.start_at))} className={fieldCls} /></div>
                <div><label htmlFor="r-time">{S.appt.time}</label><input id="r-time" name="time" type="time" step={300} required defaultValue={localTimeOf(new Date(a.start_at))} className={fieldCls} /></div>
              </div>
              <label className="flex items-center gap-2"><input type="checkbox" name="override" className="size-5" /> {S.appt.overrideNotice}</label>
              {a.customer_email ? <label className="flex items-center gap-2"><input type="checkbox" name="notify" defaultChecked className="size-5" /> {S.appt.notify}</label> : <p className="text-sm">{S.appt.noEmail}</p>}
              <SubmitButton>{S.appt.reschedule}</SubmitButton>
            </form>
          </section>

          <section aria-labelledby="canc" className="mt-6 rounded-xl border border-red-300 p-4">
            <h2 id="canc" className="text-2xl text-red-900">{S.appt.cancelTitle}</h2>
            <form action={cancelAppointmentAction} className="mt-3 space-y-3">
              <input type="hidden" name="id" value={a.id} />
              <div><label htmlFor="reason">{S.appt.reason}</label><input id="reason" name="reason" maxLength={300} className={fieldCls} /></div>
              {a.customer_email ? <label className="flex items-center gap-2"><input type="checkbox" name="notify" defaultChecked className="size-5" /> {S.appt.notify}</label> : <p className="text-sm">{S.appt.noEmail}</p>}
              <label className="flex items-center gap-2 font-semibold"><input type="checkbox" name="confirm" value="yes" required className="size-5" /> {S.common.confirmDelete}</label>
              <SubmitButton variant="outlineLight" className="border-red-800 text-red-900">{S.appt.cancelConfirm}</SubmitButton>
            </form>
          </section>
        </>
      )}

      <section aria-labelledby="hist" className="mt-8">
        <h2 id="hist" className="text-2xl text-heading">{S.appt.history}</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {(history ?? []).map((h) => <li key={h.id}>{fmtDateTime(h.created_at)} – {h.action}{h.new_data?.status ? ` → ${S.status[h.new_data.status as string] ?? h.new_data.status}` : ""}</li>)}
          {(history ?? []).length === 0 && <li>{S.common.none}</li>}
        </ul>
      </section>
    </div>
  );
}
