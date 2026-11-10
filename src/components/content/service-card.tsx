import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { formatPrice, mediaUrl, pick, servicePriceCents } from "@/lib/content/locale";
import type { Locale, Service } from "@/lib/content/types";
import { MediaImg } from "./media-img";

export async function ServiceCard({ service, locale, currency, showBook = true }: { service: Service; locale: Locale; currency: string; showBook?: boolean }) {
  const t = await getTranslations("content");
  const price = servicePriceCents(service);
  const img = mediaUrl(service.image_path);
  const variants = [...service.service_variants].sort((a, b) => a.display_order - b.display_order);
  return (
    <article className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-gold-600/50 bg-parchment-card shadow-md shadow-burgundy-900/15">
      {img && <MediaImg src={img} alt="" className="h-44 w-full object-cover" />}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-2xl text-heading">{pick(locale, service.name_bg, service.name_en)}</h3>
        {price && (
          <p className="mt-2 inline-block self-start rounded-md bg-wine px-3 py-1 text-sm font-bold text-gold-400 shadow-sm">
            {t("from", { price: formatPrice(price.cents, currency, locale) })}
          </p>
        )}
        <p className="mt-2 flex-1">{pick(locale, service.description_bg, service.description_en)}</p>
        {service.duration_mode === "size_based" ? (
          <ul className="mt-3 space-y-1 text-sm">
            {variants.map((v) => (
              <li key={v.id} className="flex justify-between gap-3">
                <span>{pick(locale, v.label_bg, v.label_en)} · {t("duration", { minutes: v.duration_minutes })}</span>
                <span className="font-semibold">{formatPrice(v.price_cents, currency, locale)}</span>
              </li>
            ))}
          </ul>
        ) : (
          price && (
            <p className="mt-3 font-semibold">
              {service.fixed_duration_minutes ? `${t("duration", { minutes: service.fixed_duration_minutes })} · ` : ""}
              {formatPrice(price.cents, currency, locale)}
            </p>
          )
        )}
        {showBook && service.booking_enabled && (
          <Button asChild className="mt-4 self-start">
            <Link href={{ pathname: "/booking", query: { service: service.id } }}>{t("bookService")}</Link>
          </Button>
        )}
      </div>
    </article>
  );
}
