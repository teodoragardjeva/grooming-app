import type { Metadata } from "next";

export const LOCALES = ["bg", "en"] as const;
export type SiteLocale = (typeof LOCALES)[number];

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** Public path for a locale with localePrefix "as-needed": bg -> "/x", en -> "/en/x". */
export function localizedPath(locale: SiteLocale, path: string): string {
  const clean = path === "/" ? "" : path.replace(/\/$/, "");
  if (locale === "bg") return clean === "" ? "/" : clean;
  return `/en${clean}`;
}

/** canonical + hreflang alternates (x-default points to Bulgarian). */
export function buildAlternates(locale: SiteLocale, path: string): NonNullable<Metadata["alternates"]> {
  return {
    canonical: localizedPath(locale, path),
    languages: {
      bg: localizedPath("bg", path),
      en: localizedPath("en", path),
      "x-default": localizedPath("bg", path),
    },
  };
}
