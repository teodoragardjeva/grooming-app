import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { PlaceholderKey } from "@/components/placeholder-page";
import { buildAlternates, type SiteLocale } from "./metadata";

export async function pageMetadata(
  locale: SiteLocale,
  path: string,
  page: PlaceholderKey,
): Promise<Metadata> {
  const t = await getTranslations({ locale });
  return {
    title: t(`pages.${page}.title`),
    description: t(`pages.${page}.intro`),
    alternates: buildAlternates(locale, path),
  };
}
