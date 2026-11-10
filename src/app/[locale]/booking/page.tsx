import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BookingFlow } from "@/components/booking/booking-flow";
import type { BookingService } from "@/components/booking/types";
import { PageHero, PageSection } from "@/components/page-hero";
import { resolveLocale, type LocaleParams } from "@/i18n/locale";
import { pick } from "@/lib/content/locale";
import { getServices, getSettings } from "@/lib/content/queries";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  return pageMetadata(await resolveLocale(params), "/booking", "booking");
}

export default async function Page({ params, searchParams }: LocaleParams & { searchParams: Promise<{ service?: string }> }) {
  const locale = await resolveLocale(params);
  const { service } = await searchParams;
  const t = await getTranslations();
  const [settings, services] = await Promise.all([getSettings(), getServices()]);

  const items: BookingService[] = services
    .filter((s) => s.booking_enabled)
    .map((s) => ({
      id: s.id,
      name: pick(locale, s.name_bg, s.name_en),
      description: pick(locale, s.description_bg, s.description_en),
      durationMinutes: s.fixed_duration_minutes,
      priceCents: s.fixed_price_cents,
      variants: s.duration_mode === "size_based"
        ? [...s.service_variants].sort((a, b) => a.display_order - b.display_order).map((v) => ({
            id: v.id, label: pick(locale, v.label_bg, v.label_en), durationMinutes: v.duration_minutes, priceCents: v.price_cents,
          }))
        : [],
    }));

  return (
    <>
      <BreadcrumbJsonLd page="booking" path="/booking" />
      <PageHero title={t("pages.booking.title")} intro={t("pages.booking.intro")} />
      <PageSection>
        {settings ? (
          <BookingFlow
            services={items}
            currency={settings.currency}
            horizonDays={settings.horizon_days}
            holdMinutes={settings.confirmation_ttl_minutes}
            turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined}
            initialServiceId={items.some((i) => i.id === service) ? service : undefined}
          />
        ) : (
          <p className="rounded-2xl bg-parchment-100 p-6 text-lg">{t("booking.notConfigured")}</p>
        )}
      </PageSection>
    </>
  );
}
