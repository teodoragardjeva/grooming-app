import type { Metadata } from "next";
import { LegalPage } from "@/components/content/legal-page";
import { resolveLocale, type LocaleParams } from "@/i18n/locale";
import { pageMetadata } from "@/lib/seo/page-metadata";

export const revalidate = 60;

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  return pageMetadata(await resolveLocale(params), "/legal/terms", "terms");
}

export default async function Page({ params }: LocaleParams) {
  const locale = await resolveLocale(params);
  return <LegalPage page="terms" locale={locale as "bg" | "en"} />;
}
