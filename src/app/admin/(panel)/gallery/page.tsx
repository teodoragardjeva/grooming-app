import { Flash, fieldCls } from "@/components/admin/flash";
import { MediaImg } from "@/components/content/media-img";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/admin/auth";
import { S } from "@/lib/admin/strings";
import { mediaUrl } from "@/lib/content/locale";
import { deleteImageAction, updateImageAction, uploadImageAction } from "./actions";

interface Img { id: string; storage_path: string; caption_bg: string | null; caption_en: string | null; alt_bg: string | null; alt_en: string | null; category: string | null; display_order: number; is_published: boolean }

export default async function GalleryAdminPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { db } = await requireAdmin();
  const sp = await searchParams;
  const { data } = await db.from("gallery_images").select("*").order("display_order");
  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-3xl text-heading">{S.gallery.title}</h1>
      <Flash ok={sp.ok} err={sp.err} />
      <section aria-labelledby="up" className="rounded-xl border-2 border-gold-500 p-4">
        <h2 id="up" className="mb-3 text-2xl text-heading">{S.gallery.upload}</h2>
        <form action={uploadImageAction} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><label htmlFor="file">{S.gallery.file}</label><input id="file" name="file" type="file" accept="image/jpeg,image/png,image/webp" required className={fieldCls} /></div>
          <div><label htmlFor="cb">{S.gallery.caption}</label><input id="cb" name="caption_bg" className={fieldCls} /></div>
          <div><label htmlFor="ce">{S.gallery.captionEn}</label><input id="ce" name="caption_en" className={fieldCls} /></div>
          <div><label htmlFor="ab">{S.gallery.alt}</label><input id="ab" name="alt_bg" className={fieldCls} /></div>
          <div><label htmlFor="ae">{S.gallery.altEn}</label><input id="ae" name="alt_en" className={fieldCls} /></div>
          <div><label htmlFor="cat">{S.gallery.category}</label><input id="cat" name="category" className={fieldCls} /></div>
          <div><label htmlFor="ord">{S.common.order}</label><input id="ord" name="order" type="number" defaultValue={0} className={fieldCls} /></div>
          <div><SubmitButton>{S.gallery.upload}</SubmitButton></div>
        </form>
      </section>
      <ul className="space-y-6">
        {((data ?? []) as Img[]).map((g) => {
          const src = mediaUrl(g.storage_path);
          return (
            <li key={g.id} className="grid gap-4 rounded-xl border border-burgundy-800/20 p-4 sm:grid-cols-[10rem_1fr]">
              {src ? <MediaImg src={src} alt={g.alt_bg ?? g.caption_bg ?? ""} className="aspect-square w-full rounded-lg object-cover" /> : <div className="aspect-square rounded-lg bg-parchment-200" />}
              <div>
                <form action={updateImageAction} className="grid gap-2 sm:grid-cols-2">
                  <input type="hidden" name="id" value={g.id} />
                  <div><label htmlFor={`${g.id}-cb`}>{S.gallery.caption}</label><input id={`${g.id}-cb`} name="caption_bg" defaultValue={g.caption_bg ?? ""} className={fieldCls} /></div>
                  <div><label htmlFor={`${g.id}-ce`}>{S.gallery.captionEn}</label><input id={`${g.id}-ce`} name="caption_en" defaultValue={g.caption_en ?? ""} className={fieldCls} /></div>
                  <div><label htmlFor={`${g.id}-ab`}>{S.gallery.alt}</label><input id={`${g.id}-ab`} name="alt_bg" defaultValue={g.alt_bg ?? ""} className={fieldCls} /></div>
                  <div><label htmlFor={`${g.id}-ae`}>{S.gallery.altEn}</label><input id={`${g.id}-ae`} name="alt_en" defaultValue={g.alt_en ?? ""} className={fieldCls} /></div>
                  <div><label htmlFor={`${g.id}-c`}>{S.gallery.category}</label><input id={`${g.id}-c`} name="category" defaultValue={g.category ?? ""} className={fieldCls} /></div>
                  <div><label htmlFor={`${g.id}-o`}>{S.common.order}</label><input id={`${g.id}-o`} name="order" type="number" defaultValue={g.display_order} className={fieldCls} /></div>
                  <label className="flex items-center gap-2"><input type="checkbox" name="published" defaultChecked={g.is_published} className="size-5" /> {S.common.published}</label>
                  <div><SubmitButton size="sm">{S.common.save}</SubmitButton></div>
                </form>
                <form action={deleteImageAction} className="mt-3 flex flex-wrap items-center gap-3 border-t pt-2">
                  <input type="hidden" name="id" value={g.id} />
                  <label className="flex items-center gap-2"><input type="checkbox" name="confirm" value="yes" required className="size-5" /> {S.common.confirmDelete}</label>
                  <SubmitButton size="sm" variant="outlineLight" className="border-red-800 text-red-900">{S.common.delete}</SubmitButton>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
