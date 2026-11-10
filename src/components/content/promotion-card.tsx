import { getTranslations } from "next-intl/server";
import { mediaUrl, pick } from "@/lib/content/locale";
import type { Locale, Promotion } from "@/lib/content/types";
import { MediaImg } from "./media-img";

export async function PromotionCard({ promo, locale }: { promo: Promotion; locale: Locale }) {
  const t = await getTranslations("content");
  const img = mediaUrl(promo.image_path);
  const until = promo.ends_at
    ? new Intl.DateTimeFormat(locale === "bg" ? "bg-BG" : "en-GB", { dateStyle: "long", timeZone: "Europe/Sofia" }).format(new Date(promo.ends_at))
    : null;
  return (
    <article className="overflow-hidden rounded-2xl border-2 border-gold-400 bg-wine text-parchment-50 shadow-lg shadow-burgundy-900/25">
      {img && <MediaImg src={img} alt="" className="h-44 w-full object-cover" />}
      <div className="p-5">
        <h3 className="text-2xl text-gold-400">{pick(locale, promo.title_bg, promo.title_en)}</h3>
        <p className="mt-2 text-parchment-100">{pick(locale, promo.description_bg, promo.description_en)}</p>
        {until && <p className="mt-3 inline-block rounded-md bg-parchment-100 px-3 py-1 text-sm font-semibold text-burgundy-700">{t("validUntil", { date: until })}</p>}
      </div>
    </article>
  );
}
