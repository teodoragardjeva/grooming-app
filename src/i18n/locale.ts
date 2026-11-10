import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing, type AppLocale } from "./routing";

export type LocaleParams = { params: Promise<{ locale?: string }> };

/**
 * Resolves the active locale and enables static rendering.
 *
 * - Valid `[locale]` segment -> that locale.
 * - Invalid segment (e.g. /favicon.ico, which bypasses the proxy matcher) -> 404.
 * - Missing segment: Next.js prerenders the built-in `_not-found` route without route params.
 *   Reading request headers there would turn a 404 into a 500, so fall back to the default
 *   locale, which is static-safe.
 */
export async function resolveLocale(params: LocaleParams["params"]): Promise<AppLocale> {
  const { locale } = await params;
  if (locale === undefined) {
    setRequestLocale(routing.defaultLocale);
    return routing.defaultLocale;
  }
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return locale;
}
