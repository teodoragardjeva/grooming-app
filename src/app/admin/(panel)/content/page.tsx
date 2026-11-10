import { Flash, fieldCls } from "@/components/admin/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/admin/auth";
import { S } from "@/lib/admin/strings";
import { saveContentAction } from "./actions";

const ITEMS: [string, string][] = [
  ["about.body", S.content.about], ["contacts.hours", S.content.hours], ["legal.privacy", S.content.privacy], ["legal.terms", S.content.terms], ["legal.cookies", S.content.cookies],
];

export default async function ContentPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { db } = await requireAdmin();
  const sp = await searchParams;
  const { data } = await db.from("site_content").select("key,content_bg,content_en");
  const map = new Map((data ?? []).map((r) => [r.key as string, r]));
  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-3xl text-heading">{S.content.title}</h1>
      <p>{S.content.help}</p>
      <Flash ok={sp.ok} err={sp.err} />
      {ITEMS.map(([key, label]) => (
        <section key={key} aria-labelledby={`h-${key}`} className="rounded-xl border border-burgundy-800/20 p-4">
          <h2 id={`h-${key}`} className="text-xl text-heading">{label}</h2>
          <form action={saveContentAction} className="mt-3 space-y-3">
            <input type="hidden" name="key" value={key} />
            <div><label htmlFor={`${key}-bg`}>{S.content.bg}</label><textarea id={`${key}-bg`} name="bg" rows={6} defaultValue={map.get(key)?.content_bg ?? ""} className={fieldCls} /></div>
            <div><label htmlFor={`${key}-en`}>{S.content.en}</label><textarea id={`${key}-en`} name="en" rows={6} defaultValue={map.get(key)?.content_en ?? ""} className={fieldCls} /></div>
            <SubmitButton>{S.common.save}</SubmitButton>
          </form>
        </section>
      ))}
    </div>
  );
}
