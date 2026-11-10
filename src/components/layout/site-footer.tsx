import { getTranslations } from "next-intl/server";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { NAV_ITEMS } from "./nav-items";
import { Sparkles } from "./decor";
import { pick } from "@/lib/content/locale";
import { getSettings } from "@/lib/content/queries";

export async function SiteFooter({ locale = "bg" }: { locale?: "bg" | "en" }) {
  const t = await getTranslations();
  const settings = await getSettings();
  const example = !settings || settings.is_example_data;
  const year = new Date().getFullYear();
  const link = "inline-flex min-h-11 items-center text-mist underline-offset-4 hover:text-gold-300 hover:underline";

  return (
    <footer className="relative mt-auto overflow-hidden border-t-2 border-gold-400/60 bg-wine text-parchment-50">
      <Sparkles className="opacity-50" />
      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1.4fr_1fr]">
        <div>
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- small static artwork supplied by the owner */}
            <img src="/footer-brand.png" alt="" width={155} height={108} className="footer-art-mask h-auto w-36 shrink-0" />
            <p className="font-serif text-2xl font-bold leading-tight text-gold-400">{t("meta.siteName")}</p>
          </div>
          <p className="mt-3 max-w-xs text-mist">{t("footer.about")}</p>
        </div>

        <nav aria-label={t("footer.linksTitle")}>
          <h2 className="text-xl text-gold-100">{t("footer.linksTitle")}</h2>
          <ul className="mt-2">
            {NAV_ITEMS.map((item) => (
              <li key={item.key}>
                <Link href={item.href} className={link}>{t(`nav.${item.key}`)}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="text-xl text-gold-100">{t("footer.contactsTitle")}</h2>
          {example && (
            <p className="mt-1 inline-block rounded-full bg-gold-foil px-2 py-0.5 text-xs font-bold text-burgundy-900">
              {t("common.exampleBadge")}
            </p>
          )}
          <ul className="mt-3 space-y-2 text-mist">
            <li className="flex items-start gap-2">
              <MapPin aria-hidden="true" className="mt-1 size-4 shrink-0 text-gold-400" />
              {(!example && settings && pick(locale, settings.address_bg, settings.address_en)) || t("footer.addressExample")}
            </li>
            <li className="flex items-start gap-2">
              <Phone aria-hidden="true" className="mt-1 size-4 shrink-0 text-gold-400" />
              {(!example && settings?.phone) || t("footer.phoneExample")}
            </li>
            <li className="flex items-start gap-2">
              <Mail aria-hidden="true" className="mt-1 size-4 shrink-0 text-gold-400" />
              {(!example && settings?.email) || t("footer.emailExample")}
            </li>
            <li className="flex items-start gap-2">
              <Clock aria-hidden="true" className="mt-1 size-4 shrink-0 text-gold-400" />
              {t("footer.hoursExample")}
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl text-gold-100">{t("footer.legalTitle")}</h2>
          <ul className="mt-2">
            {(["privacy", "terms", "cookies"] as const).map((key) => (
              <li key={key}>
                <Link href={`/legal/${key}`} className={link}>{t(`footer.${key}`)}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="relative border-t border-gold-400/30 px-4 py-4 text-center text-sm text-mist">
        © {year} {t("meta.siteName")}. {t("footer.rights")}
      </p>
    </footer>
  );
}
