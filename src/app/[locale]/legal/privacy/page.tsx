import type { Metadata } from "next";
import { LegalPage } from "@/components/content/legal-page";
import { resolveLocale, type LocaleParams } from "@/i18n/locale";
import { pageMetadata } from "@/lib/seo/page-metadata";

export const dynamic = "force-dynamic"; // content comes from the database: never serve a build-time (empty) copy

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  return pageMetadata(await resolveLocale(params), "/legal/privacy", "privacy");
}

export default async function Page({ params }: LocaleParams) {
  const locale = await resolveLocale(params);
  return <LegalPage page="privacy" locale={locale as "bg" | "en"} />;
}
