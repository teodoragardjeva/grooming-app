import { getLocale, getTranslations } from "next-intl/server";
import type { PlaceholderKey } from "@/components/placeholder-page";
import { JsonLd } from "./json-ld";
import { localizedPath, siteUrl, type SiteLocale } from "@/lib/seo/metadata";

/** BreadcrumbList (Home > page) for sub pages. */
export async function BreadcrumbJsonLd({ page, path }: { page: PlaceholderKey; path: string }) {
  const locale = (await getLocale()) as SiteLocale;
  const t = await getTranslations();
  const abs = (p: string) => `${siteUrl()}${localizedPath(locale, p)}`;
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: t("nav.home"), item: abs("/") },
          { "@type": "ListItem", position: 2, name: t(`pages.${page}.title`), item: abs(path) },
        ],
      }}
    />
  );
}
