import { Flash, fieldCls } from "@/components/admin/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/admin/auth";
import { eur } from "@/lib/admin/parse";
import { S } from "@/lib/admin/strings";
import { deleteServiceAction, saveServiceAction } from "./actions";

const SIZES = ["small", "medium", "large", "xlarge"] as const;
interface Variant { size_key: string; label_bg: string; label_en: string | null; duration_minutes: number; price_cents: number }
interface Svc {
  id: string; name_bg: string; name_en: string | null; description_bg: string | null; description_en: string | null; booking_enabled: boolean; display_order: number;
  duration_mode: "fixed" | "size_based"; fixed_duration_minutes: number | null; fixed_price_cents: number | null;
  prep_buffer_minutes: number | null; cleanup_buffer_minutes: number | null; service_variants: Variant[];
}

function ServiceForm({ s }: { s?: Svc }) {
  const v = (k: string) => s?.service_variants.find((x) => x.size_key === k);
  const p = s?.id ?? "new";
  return (
    <form action={saveServiceAction} className="space-y-3">
      {s && <input type="hidden" name="id" value={s.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label htmlFor={`${p}-n`}>{S.services.name}</label><input id={`${p}-n`} name="name_bg" required defaultValue={s?.name_bg} className={fieldCls} /></div>
        <div><label htmlFor={`${p}-ne`}>{S.services.nameEn}</label><input id={`${p}-ne`} name="name_en" defaultValue={s?.name_en ?? ""} className={fieldCls} /></div>
        <div><label htmlFor={`${p}-d`}>{S.services.desc}</label><textarea id={`${p}-d`} name="description_bg" rows={2} defaultValue={s?.description_bg ?? ""} className={fieldCls} /></div>
        <div><label htmlFor={`${p}-de`}>{S.services.descEn}</label><textarea id={`${p}-de`} name="description_en" rows={2} defaultValue={s?.description_en ?? ""} className={fieldCls} /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <div><label htmlFor={`${p}-m`}>{S.services.mode}</label>
          <select id={`${p}-m`} name="mode" defaultValue={s?.duration_mode ?? "fixed"} className={fieldCls}><option value="fixed">{S.services.fixed}</option><option value="size_based">{S.services.sizeBased}</option></select></div>
        <div><label htmlFor={`${p}-du`}>{S.services.duration}</label><input id={`${p}-du`} name="duration" type="number" min={5} step={5} defaultValue={s?.fixed_duration_minutes ?? ""} className={fieldCls} /></div>
        <div><label htmlFor={`${p}-pr`}>{S.services.price} (EUR)</label><input id={`${p}-pr`} name="price" inputMode="decimal" defaultValue={eur(s?.fixed_price_cents)} className={fieldCls} /></div>
        <div><label htmlFor={`${p}-o`}>{S.common.order}</label><input id={`${p}-o`} name="order" type="number" defaultValue={s?.display_order ?? 0} className={fieldCls} /></div>
        <div><label htmlFor={`${p}-pb`}>{S.services.prep}</label><input id={`${p}-pb`} name="prep" type="number" min={0} defaultValue={s?.prep_buffer_minutes ?? ""} className={fieldCls} /></div>
        <div><label htmlFor={`${p}-cb`}>{S.services.cleanup}</label><input id={`${p}-cb`} name="cleanup" type="number" min={0} defaultValue={s?.cleanup_buffer_minutes ?? ""} className={fieldCls} /></div>
        <p className="self-end text-sm sm:col-span-2">{S.services.bufferHelp}</p>
      </div>
      <fieldset className="rounded-lg border border-burgundy-800/20 p-3">
        <legend className="px-1 font-semibold">{S.services.variants}</legend>
        {SIZES.map((k) => (
          <div key={k} className="mt-2 grid gap-2 sm:grid-cols-5">
            <span className="self-center font-semibold">{S.services.sizes[k]}</span>
            <div><label className="sr-only" htmlFor={`${p}-${k}-l`}>{S.services.label} {S.services.sizes[k]}</label><input id={`${p}-${k}-l`} placeholder={S.services.label} name={`v_${k}_label`} defaultValue={v(k)?.label_bg ?? ""} className={fieldCls} /></div>
            <div><label className="sr-only" htmlFor={`${p}-${k}-le`}>{S.services.labelEn} {S.services.sizes[k]}</label><input id={`${p}-${k}-le`} placeholder={S.services.labelEn} name={`v_${k}_label_en`} defaultValue={v(k)?.label_en ?? ""} className={fieldCls} /></div>
            <div><label className="sr-only" htmlFor={`${p}-${k}-d`}>{S.services.duration} {S.services.sizes[k]}</label><input id={`${p}-${k}-d`} placeholder={S.services.duration} name={`v_${k}_duration`} type="number" min={5} step={5} defaultValue={v(k)?.duration_minutes ?? ""} className={fieldCls} /></div>
            <div><label className="sr-only" htmlFor={`${p}-${k}-p`}>{S.services.price} {S.services.sizes[k]}</label><input id={`${p}-${k}-p`} placeholder={`${S.services.price} (EUR)`} name={`v_${k}_price`} inputMode="decimal" defaultValue={eur(v(k)?.price_cents)} className={fieldCls} /></div>
          </div>
        ))}
      </fieldset>
      <label className="flex items-center gap-2"><input type="checkbox" name="booking" defaultChecked={s?.booking_enabled ?? true} className="size-5" /> {S.services.booking}</label>
      <SubmitButton>{S.common.save}</SubmitButton>
    </form>
  );
}

export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { db } = await requireAdmin();
  const sp = await searchParams;
  const { data } = await db.from("services").select("*, service_variants(size_key,label_bg,label_en,duration_minutes,price_cents)").order("display_order");
  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-3xl text-heading">{S.services.title}</h1>
      <Flash ok={sp.ok} err={sp.err} />
      {((data ?? []) as Svc[]).map((s) => (
        <details key={s.id} className="rounded-xl border border-burgundy-800/20 p-4">
          <summary className="cursor-pointer text-xl font-semibold">{s.name_bg}</summary>
          <div className="mt-4"><ServiceForm s={s} /></div>
          <form action={deleteServiceAction} className="mt-4 flex flex-wrap items-center gap-3 border-t pt-3">
            <input type="hidden" name="id" value={s.id} />
            <label className="flex items-center gap-2"><input type="checkbox" name="confirm" value="yes" required className="size-5" /> {S.common.confirmDelete}</label>
            <SubmitButton variant="outlineLight" size="sm" className="border-red-800 text-red-900">{S.common.delete}</SubmitButton>
            <span className="text-sm">{S.services.deleteWarn}</span>
          </form>
        </details>
      ))}
      <section aria-labelledby="new" className="rounded-xl border-2 border-gold-500 p-4">
        <h2 id="new" className="mb-3 text-2xl text-heading">{S.services.new}</h2>
        <ServiceForm />
      </section>
    </div>
  );
}
