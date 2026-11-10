"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("language");
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <nav aria-label={t("label")} className={cn("flex items-center text-sm font-semibold", className)}>
      {routing.locales.map((l, i) => (
        <span key={l} className="flex items-center">
          {i > 0 && (
            <span aria-hidden="true" className="px-1 text-gold-400/60">
              |
            </span>
          )}
          <Link
            href={pathname}
            locale={l}
            lang={l}
            hrefLang={l}
            aria-label={t(l)}
            aria-current={l === locale ? "true" : undefined}
            className={cn(
              "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-2 uppercase tracking-wide",
              l === locale
                ? "bg-gold-400 text-burgundy-900"
                : "text-parchment-50 hover:text-gold-400",
            )}
          >
            {l}
          </Link>
        </span>
      ))}
    </nav>
  );
}
