import { getTranslations } from "next-intl/server";
import { Sparkles as SparkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { mediaUrl, pick } from "@/lib/content/locale";
import type { Locale, Promotion } from "@/lib/content/types";
import { MediaImg } from "./media-img";

/** Featured, "exclusive" promotion banner: wine background, gold frame, ticket with the end date. */
export async function PromoBanner({ promo, locale }: { promo: Promotion; locale: Locale }) {
  const t = await getTranslations("content");
  const img = mediaUrl(promo.image_path);
  const until = promo.ends_at
    ? new Intl.DateTimeFormat(locale === "bg" ? "bg-BG" : "en-GB", { dateStyle: "long", timeZone: "Europe/Sofia" }).format(new Date(promo.ends_at))
    : null;
  return (
    <article className="relative overflow-hidden rounded-3xl border-2 border-gold-400 bg-wine p-1 text-parchment-50 shadow-2xl shadow-burgundy-900/40">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgba(245,220,143,0.28),transparent_45%),radial-gradient(circle_at_5%_100%,rgba(245,220,143,0.14),transparent_40%)]" />
      <div aria-hidden="true" className="promo-shine pointer-events-none absolute inset-0" />
      <div className="relative grid items-center gap-6 rounded-[1.4rem] border border-gold-400/50 px-6 py-8 sm:px-10 md:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-gold-400/70 bg-black/20 px-3 py-1 text-xs font-bold uppercase tracking-widest text-gold-300">
            <SparkIcon aria-hidden="true" className="size-4" /> {t("promoBadge")}
          </p>
          <h3 className="mt-4 text-4xl font-medium leading-tight text-gold-100 sm:text-5xl">{pick(locale, promo.title_bg, promo.title_en)}</h3>
          <p className="mt-3 max-w-xl text-lg text-cream-50">{pick(locale, promo.description_bg, promo.description_en)}</p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Button asChild size="lg"><Link href="/booking">{t("promoCta")}</Link></Button>
            {until && (
              <p className="-rotate-2 rounded-md border border-gold-600 bg-parchment-card px-4 py-2 text-sm font-semibold text-heading shadow-md">{t("validUntil", { date: until })}</p>
            )}
          </div>
        </div>
        {img && <MediaImg src={img} alt="" className="aspect-[4/3] w-full rounded-2xl border-2 border-gold-400 object-cover shadow-xl md:rotate-2" />}
      </div>
    </article>
  );
}
