import type { Locale } from "./types.ts";

/** English falls back to Bulgarian when the English field is empty. */
export function pick(locale: Locale, bg: string | null | undefined, en: string | null | undefined): string {
  if (locale === "en" && en && en.trim() !== "") return en;
  return bg ?? "";
}

/** Splits admin-edited plain text into paragraphs (blank-line separated). No HTML is ever rendered. */
export function paragraphs(text: string | null | undefined): string[] {
  return (text ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Public URL of an uploaded image (served by src/app/media). */
export function mediaUrl(path: string | null | undefined): string | null {
  return path ? `/media/${path}` : null;
}

export function formatPrice(cents: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(locale === "bg" ? "bg-BG" : "en-GB", { style: "currency", currency }).format(cents / 100);
}

/** Price label for a service: fixed price, or "from X" for size-based services. */
export function servicePriceCents(s: {
  duration_mode: string;
  fixed_price_cents: number | null;
  service_variants: { price_cents: number }[];
}): { cents: number; isFrom: boolean } | null {
  if (s.duration_mode === "fixed") return s.fixed_price_cents == null ? null : { cents: s.fixed_price_cents, isFrom: false };
  if (s.service_variants.length === 0) return null;
  return { cents: Math.min(...s.service_variants.map((v) => v.price_cents)), isFrom: s.service_variants.length > 1 };
}
