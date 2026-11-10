import { pick, servicePriceCents } from "../content/locale.ts";
import type { Locale, Service } from "../content/types.ts";
import { localizedPath, siteUrl } from "./metadata.ts";

const abs = (locale: Locale, path: string) => `${siteUrl()}${localizedPath(locale, path)}`;

/** WebSite + Organization (no contact data: those may still be example placeholders). */
export function siteJsonLd(locale: Locale, name: string) {
  return [
    { "@context": "https://schema.org", "@type": "WebSite", name, url: abs(locale, "/"), inLanguage: locale === "bg" ? "bg-BG" : "en" },
    { "@context": "https://schema.org", "@type": "Organization", name, url: abs("bg", "/"), logo: `${siteUrl()}/icon.png` },
  ];
}

/** Services with prices/durations as schema.org Service + Offer (what AI assistants quote). */
export function servicesJsonLd(locale: Locale, services: Service[], currency: string, studioName: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: services.map((s, i) => {
      const price = servicePriceCents(s);
      const offers = s.duration_mode === "size_based"
        ? s.service_variants.map((v) => ({
            "@type": "Offer", name: pick(locale, v.label_bg, v.label_en), priceCurrency: currency, price: (v.price_cents / 100).toFixed(2),
          }))
        : price ? [{ "@type": "Offer", priceCurrency: currency, price: (price.cents / 100).toFixed(2) }] : [];
      return {
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "Service",
          name: pick(locale, s.name_bg, s.name_en),
          description: pick(locale, s.description_bg, s.description_en) || undefined,
          provider: { "@type": "Organization", name: studioName },
          ...(offers.length ? { offers } : {}),
        },
      };
    }),
  };
}
