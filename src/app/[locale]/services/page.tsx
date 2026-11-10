import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ServiceCard } from "@/components/content/service-card";
import { PageHero, PageSection } from "@/components/page-hero";
import { resolveLocale, type LocaleParams } from "@/i18n/locale";
import { getServices, getSettings } from "@/lib/content/queries";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { servicesJsonLd } from "@/lib/seo/structured-data";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { Faq } from "@/components/seo/faq";
import { JsonLd } from "@/components/seo/json-ld";
import { pick } from "@/lib/content/locale";

export const revalidate = 60;

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  return pageMetadata(await resolveLocale(params), "/services", "services");
}

export default async function Page({ params }: LocaleParams) {
  const locale = await resolveLocale(params);
  const t = await getTranslations();
  const [services, settings] = await Promise.all([getServices(), getSettings()]);
  return (
    <>
      <BreadcrumbJsonLd page="services" path="/services" />
      {services.length > 0 && <JsonLd data={servicesJsonLd(locale, services, settings?.currency ?? "EUR", settings ? pick(locale, settings.studio_name_bg, settings.studio_name_en) : t("meta.siteName"))} />}
      <PageHero title={t("pages.services.title")} intro={t("pages.services.intro")} />
      <PageSection>
        {services.length === 0 ? (
          <p className="rounded-2xl bg-parchment-100 p-6 text-lg">{t("content.noServices")}</p>
        ) : (
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <li key={s.id} className="flex">
                <div className="flex w-full"><ServiceCard service={s} locale={locale} currency={settings?.currency ?? "EUR"} /></div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-6">{t("content.paymentNote")}</p>
        <Faq confirmMinutes={settings?.confirmation_ttl_minutes ?? 10} cancelHours={settings?.cancel_cutoff_hours ?? 24} />
      </PageSection>
    </>
  );
}
