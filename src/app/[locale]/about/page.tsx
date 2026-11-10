import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHero, PageSection } from "@/components/page-hero";
import { resolveLocale, type LocaleParams } from "@/i18n/locale";
import { paragraphs, pick } from "@/lib/content/locale";
import { getSiteContent } from "@/lib/content/queries";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";

export const revalidate = 60;

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  return pageMetadata(await resolveLocale(params), "/about", "about");
}

export default async function Page({ params }: LocaleParams) {
  const locale = await resolveLocale(params);
  const t = await getTranslations();
  const row = (await getSiteContent(["about.body"]))["about.body"];
  const text = pick(locale, row?.content_bg, row?.content_en);
  const paras = text ? paragraphs(text) : [t("content.aboutDefault")];
  return (
    <>
      <BreadcrumbJsonLd page="about" path="/about" />
      <PageHero title={t("pages.about.title")} intro={t("pages.about.intro")} />
      <PageSection>
        <div className="max-w-3xl space-y-4 text-lg">
          {paras.map((p, i) => <p key={i}>{p}</p>)}
        </div>
      </PageSection>
    </>
  );
}
