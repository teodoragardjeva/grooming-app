import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { GalleryGrid } from "@/components/content/gallery-grid";
import { PageHero, PageSection } from "@/components/page-hero";
import { resolveLocale, type LocaleParams } from "@/i18n/locale";
import { mediaUrl, pick } from "@/lib/content/locale";
import { getGallery } from "@/lib/content/queries";
import { staticGalleryItems } from "@/lib/content/photos";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";

export const revalidate = 60;

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  return pageMetadata(await resolveLocale(params), "/gallery", "gallery");
}

export default async function Page({ params }: LocaleParams) {
  const locale = await resolveLocale(params);
  const t = await getTranslations();
  const images = await getGallery();
  const dbItems = images.flatMap((g) => {
    const src = mediaUrl(g.storage_path);
    if (!src) return [];
    const caption = pick(locale, g.caption_bg, g.caption_en);
    return [{ id: g.id, src, caption, alt: pick(locale, g.alt_bg, g.alt_en) || caption }];
  });
  const tp = await getTranslations("photos");
  const items = dbItems.length > 0 ? dbItems : staticGalleryItems((k) => tp(k));
  return (
    <>
      <BreadcrumbJsonLd page="gallery" path="/gallery" />
      <PageHero title={t("pages.gallery.title")} intro={t("pages.gallery.intro")} />
      <PageSection>
        <GalleryGrid items={items} large />
      </PageSection>
    </>
  );
}
