import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Logo } from "./logo";
import { SiteNav } from "./site-nav";

export async function SiteHeader() {
  const t = await getTranslations("meta");
  return (
    <header className="relative z-30 border-b border-gold-400/40 bg-wine text-parchment-50 shadow-lg shadow-black/30">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2 sm:px-6">
        <Link href="/" className="inline-flex min-h-11 items-center gap-3">
          <Logo />
          <span className="flex flex-col leading-tight">
            <span className="font-serif text-2xl font-bold text-gold-400">{t("siteName")}</span>
            <span className="hidden text-xs text-cream-50 sm:block">{t("tagline")}</span>
          </span>
        </Link>
        <SiteNav />
      </div>
    </header>
  );
}
