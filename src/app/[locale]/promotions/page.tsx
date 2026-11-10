import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PromoBanner } from "@/components/content/promo-banner";
import { PageHero, PageSection } from "@/components/page-hero";
import { resolveLocale, type LocaleParams } from "@/i18n/locale";
import { isActivePromotion } from "@/lib/content/active-promotions";
import { getPromotions } from "@/lib/content/queries";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";

export const revalidate = 60;

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  return pageMetadata(await resolveLocale(params), "/promotions", "promotions");
}

export default async function Page({ params }: LocaleParams) {
  const locale = await resolveLocale(params);
  const t = await getTranslations();
  const now = new Date();
  const promos = (await getPromotions()).filter((p) => isActivePromotion(p, now));
  return (
    <>
      <BreadcrumbJsonLd page="promotions" path="/promotions" />
      <PageHero title={t("pages.promotions.title")} intro={t("pages.promotions.intro")} />
      <PageSection>
        {promos.length === 0 ? (
          <p className="rounded-2xl bg-parchment-100 p-6 text-lg">{t("content.noPromotions")}</p>
        ) : (
          <ul className="space-y-8">
            {promos.map((p) => <li key={p.id}><PromoBanner promo={p} locale={locale} /></li>)}
          </ul>
        )}
      </PageSection>
    </>
  );
}
