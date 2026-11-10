import { Flash, fieldCls } from "@/components/admin/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/admin/auth";
import { S } from "@/lib/admin/strings";
import { localDateOf } from "@/lib/time/dates";
import { createAppointmentAction } from "../actions";

export default async function NewAppointmentPage({ searchParams }: { searchParams: Promise<{ date?: string; time?: string; err?: string; ok?: string }> }) {
  const { db } = await requireAdmin();
  const sp = await searchParams;
  const { data } = await db.from("services").select("id,name_bg,duration_mode,fixed_duration_minutes,service_variants(id,label_bg,duration_minutes,display_order)").eq("is_active", true).order("display_order");
  type Row = { id: string; name_bg: string; duration_mode: string; fixed_duration_minutes: number | null; service_variants: { id: string; label_bg: string; duration_minutes: number; display_order: number }[] };
  const options = ((data ?? []) as Row[]).flatMap((s) =>
    s.duration_mode === "fixed"
      ? [{ value: s.id, label: `${s.name_bg} (${s.fixed_duration_minutes} мин.)` }]
      : [...s.service_variants].sort((a, b) => a.display_order - b.display_order).map((v) => ({ value: `${s.id}|${v.id}`, label: `${s.name_bg} – ${v.label_bg} (${v.duration_minutes} мин.)` })),
  );
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl text-heading">{S.appt.newTitle}</h1>
      <Flash err={sp.err} ok={sp.ok} />
      <form action={createAppointmentAction} className="mt-4 space-y-4">
        <div><label htmlFor="service">{S.appt.service}</label>
          <select id="service" name="service" required className={fieldCls}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="date">{S.appt.date}</label><input id="date" name="date" type="date" required defaultValue={sp.date ?? localDateOf(new Date())} className={fieldCls} /></div>
          <div><label htmlFor="time">{S.appt.time}</label><input id="time" name="time" type="time" step={300} required defaultValue={sp.time ?? ""} className={fieldCls} /></div>
        </div>
        <div><label htmlFor="name">{S.appt.name}</label><input id="name" name="name" required minLength={2} maxLength={100} className={fieldCls} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="phone">{S.appt.phone}</label><input id="phone" name="phone" type="tel" className={fieldCls} /></div>
          <div><label htmlFor="email">{S.appt.email}</label><input id="email" name="email" type="email" className={fieldCls} /></div>
        </div>
        <div><label htmlFor="dog">{S.appt.dog}</label><input id="dog" name="dog" className={fieldCls} /></div>
        <div><label htmlFor="notes">{S.appt.notes}</label><textarea id="notes" name="notes" rows={2} className={fieldCls} /></div>
        <div><label htmlFor="adminNotes">{S.appt.adminNotes}</label><textarea id="adminNotes" name="adminNotes" rows={2} className={fieldCls} /></div>
        <label className="flex items-center gap-2"><input type="checkbox" name="override" className="size-5" /> {S.appt.overrideNotice}</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="sendEmail" defaultChecked className="size-5" /> {S.appt.sendEmail}</label>
        <SubmitButton>{S.appt.create}</SubmitButton>
      </form>
    </div>
  );
}
