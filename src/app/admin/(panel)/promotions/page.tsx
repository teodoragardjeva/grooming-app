import { Flash, fieldCls } from "@/components/admin/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/admin/auth";
import { S } from "@/lib/admin/strings";
import { localDateOf } from "@/lib/time/dates";
import { deletePromotionAction, savePromotionAction } from "./actions";

interface Promo { id: string; title_bg: string; title_en: string | null; description_bg: string | null; description_en: string | null; starts_at: string | null; ends_at: string | null; is_published: boolean; display_order: number }

function PromoForm({ p }: { p?: Promo }) {
  const k = p?.id ?? "new";
  return (
    <form action={savePromotionAction} className="grid gap-3 sm:grid-cols-2">
      {p && <input type="hidden" name="id" value={p.id} />}
      <div><label htmlFor={`${k}-t`}>{S.promos.name}</label><input id={`${k}-t`} name="title_bg" required defaultValue={p?.title_bg} className={fieldCls} /></div>
      <div><label htmlFor={`${k}-te`}>{S.promos.nameEn}</label><input id={`${k}-te`} name="title_en" defaultValue={p?.title_en ?? ""} className={fieldCls} /></div>
      <div><label htmlFor={`${k}-d`}>{S.promos.desc}</label><textarea id={`${k}-d`} name="description_bg" rows={3} defaultValue={p?.description_bg ?? ""} className={fieldCls} /></div>
      <div><label htmlFor={`${k}-de`}>{S.promos.descEn}</label><textarea id={`${k}-de`} name="description_en" rows={3} defaultValue={p?.description_en ?? ""} className={fieldCls} /></div>
      <div><label htmlFor={`${k}-s`}>{S.promos.from}</label><input id={`${k}-s`} name="starts" type="date" defaultValue={p?.starts_at ? localDateOf(new Date(p.starts_at)) : ""} className={fieldCls} /></div>
      <div><label htmlFor={`${k}-e`}>{S.promos.to}</label><input id={`${k}-e`} name="ends" type="date" defaultValue={p?.ends_at ? localDateOf(new Date(p.ends_at)) : ""} className={fieldCls} /></div>
      <div><label htmlFor={`${k}-o`}>{S.common.order}</label><input id={`${k}-o`} name="order" type="number" defaultValue={p?.display_order ?? 0} className={fieldCls} /></div>
      <label className="flex items-center gap-2 self-end"><input type="checkbox" name="published" defaultChecked={p?.is_published} className="size-5" /> {S.common.published}</label>
      <div><SubmitButton>{S.common.save}</SubmitButton></div>
    </form>
  );
}

export default async function PromotionsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { db } = await requireAdmin();
  const sp = await searchParams;
  const { data } = await db.from("promotions").select("*").order("display_order");
  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-3xl text-heading">{S.promos.title}</h1>
      <Flash ok={sp.ok} err={sp.err} />
      {((data ?? []) as Promo[]).map((p) => (
        <details key={p.id} className="rounded-xl border border-burgundy-800/20 p-4">
          <summary className="cursor-pointer text-xl font-semibold">{p.title_bg} {p.is_published ? "" : "(чернова)"}</summary>
          <div className="mt-4"><PromoForm p={p} /></div>
          <form action={deletePromotionAction} className="mt-4 flex flex-wrap items-center gap-3 border-t pt-3">
            <input type="hidden" name="id" value={p.id} />
            <label className="flex items-center gap-2"><input type="checkbox" name="confirm" value="yes" required className="size-5" /> {S.common.confirmDelete}</label>
            <SubmitButton variant="outlineLight" size="sm" className="border-red-800 text-red-900">{S.common.delete}</SubmitButton>
          </form>
        </details>
      ))}
      <section aria-labelledby="newp" className="rounded-xl border-2 border-gold-500 p-4">
        <h2 id="newp" className="mb-3 text-2xl text-heading">{S.promos.new}</h2>
        <PromoForm />
      </section>
    </div>
  );
}
