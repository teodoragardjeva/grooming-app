import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { PageHero, PageSection } from "@/components/page-hero";
import { Button } from "@/components/ui/button";
import { resolveLocale, type LocaleParams } from "@/i18n/locale";
import { pick } from "@/lib/content/locale";
import { getSettings, getSiteContent } from "@/lib/content/queries";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";

export const revalidate = 60;

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  return pageMetadata(await resolveLocale(params), "/contacts", "contacts");
}

export default async function Page({ params }: LocaleParams) {
  const locale = await resolveLocale(params);
  const t = await getTranslations();
  const [settings, content] = await Promise.all([getSettings(), getSiteContent(["contacts.hours"])]);
  const address = settings ? pick(locale, settings.address_bg, settings.address_en) : "";
  const hours = pick(locale, content["contacts.hours"]?.content_bg, content["contacts.hours"]?.content_en);
  const example = !settings || settings.is_example_data;
  const tel = settings?.phone?.replace(/[^\d+]/g, "");
  return (
    <>
      <BreadcrumbJsonLd page="contacts" path="/contacts" />
      <PageHero title={t("pages.contacts.title")} intro={t("pages.contacts.intro")} />
      <PageSection>
        {example && (
          <p className="mb-6 inline-block rounded-full bg-gold-400 px-3 py-1 text-sm font-bold text-burgundy-900">{t("content.exampleNotice")}</p>
        )}
        <dl className="grid max-w-3xl gap-6 sm:grid-cols-2">
          <div>
            <dt className="flex items-center gap-2 font-semibold"><MapPin aria-hidden="true" className="size-5 text-burgundy-700" />{t("content.address")}</dt>
            <dd className="mt-1">{address || t("footer.addressExample")}</dd>
            {settings?.map_url && (
              <Button asChild variant="outlineLight" size="sm" className="mt-2"><a href={settings.map_url} target="_blank" rel="noopener noreferrer">{t("content.openMap")}</a></Button>
            )}
          </div>
          <div>
            <dt className="flex items-center gap-2 font-semibold"><Phone aria-hidden="true" className="size-5 text-burgundy-700" />{t("content.phone")}</dt>
            <dd className="mt-1">{settings?.phone ? <a className="underline" href={`tel:${tel}`}>{settings.phone}</a> : t("footer.phoneExample")}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-2 font-semibold"><Mail aria-hidden="true" className="size-5 text-burgundy-700" />{t("content.email")}</dt>
            <dd className="mt-1">{settings?.email ? <a className="underline" href={`mailto:${settings.email}`}>{settings.email}</a> : t("footer.emailExample")}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-2 font-semibold"><Clock aria-hidden="true" className="size-5 text-burgundy-700" />{t("content.hours")}</dt>
            <dd className="mt-1 whitespace-pre-line">{hours || t("footer.hoursExample")}</dd>
          </div>
        </dl>
      </PageSection>
    </>
  );
}
