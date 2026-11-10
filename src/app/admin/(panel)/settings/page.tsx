import { Flash, fieldCls } from "@/components/admin/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/admin/auth";
import { S } from "@/lib/admin/strings";
import { saveSettingsAction } from "./actions";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { db } = await requireAdmin();
  const sp = await searchParams;
  const { data: s } = await db.from("business_settings").select("*").eq("id", true).maybeSingle();
  const T = (id: string, label: string, name: string, v: string | number | null | undefined, type = "text", extra = {}) => (
    <div><label htmlFor={id}>{label}</label><input id={id} name={name} type={type} defaultValue={v ?? ""} className={fieldCls} {...extra} /></div>
  );
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl text-heading">{S.settings.title}</h1>
      <Flash ok={sp.ok} err={sp.err} />
      <form action={saveSettingsAction} className="mt-4 space-y-8">
        <fieldset className="grid gap-3 sm:grid-cols-2"><legend className="mb-2 text-2xl text-burgundy-800">{S.settings.studio}</legend>
          {T("n1", S.settings.nameBg, "studio_name_bg", s?.studio_name_bg)}{T("n2", S.settings.nameEn, "studio_name_en", s?.studio_name_en)}
          {T("p", S.settings.phone, "phone", s?.phone, "tel")}{T("e", S.settings.email, "email", s?.email, "email")}
          {T("a1", S.settings.addressBg, "address_bg", s?.address_bg)}{T("a2", S.settings.addressEn, "address_en", s?.address_en)}
          {T("m", S.settings.map, "map_url", s?.map_url, "url")}
          <div><label htmlFor="sb">{S.settings.seoBg}</label><textarea id="sb" name="seo_description_bg" rows={2} defaultValue={s?.seo_description_bg ?? ""} className={fieldCls} /></div>
          <div><label htmlFor="se">{S.settings.seoEn}</label><textarea id="se" name="seo_description_en" rows={2} defaultValue={s?.seo_description_en ?? ""} className={fieldCls} /></div>
          <label className="flex items-center gap-2 sm:col-span-2"><input type="checkbox" name="real" defaultChecked={s ? !s.is_example_data : false} className="size-5" /> {S.settings.real}</label>
        </fieldset>
        <fieldset className="grid gap-3 sm:grid-cols-3"><legend className="mb-2 text-2xl text-burgundy-800">{S.settings.booking}</legend>
          {T("sl", S.settings.slot, "slot", s?.slot_minutes, "number", { min: 5, max: 120 })}{T("mn", S.settings.minNotice, "minNotice", s?.min_notice_minutes, "number", { min: 0 })}
          {T("hz", S.settings.horizon, "horizon", s?.horizon_days, "number", { min: 1, max: 365 })}{T("tt", S.settings.ttl, "ttl", s?.confirmation_ttl_minutes, "number", { min: 1, max: 120 })}
          {T("co", S.settings.cutoff, "cutoff", s?.cancel_cutoff_hours, "number", { min: 0 })}{T("cu", S.settings.currency, "currency", s?.currency, "text", { maxLength: 3 })}
          {T("pb", S.settings.prep, "prep", s?.default_prep_buffer_minutes, "number", { min: 0 })}{T("cb", S.settings.cleanup, "cleanup", s?.default_cleanup_buffer_minutes, "number", { min: 0 })}
        </fieldset>
        <SubmitButton>{S.common.save}</SubmitButton>
      </form>
    </div>
  );
}
