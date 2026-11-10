import assert from "node:assert/strict";
import { test } from "node:test";
import { servicesJsonLd, siteJsonLd } from "../../src/lib/seo/structured-data.ts";
import type { Service } from "../../src/lib/content/types.ts";

interface Item { name: string; description?: string; provider: { name: string }; offers: { name?: string; price: string; priceCurrency: string }[] }
interface List { itemListElement: { item: Item }[] }

const fixed = { id: "1", name_bg: "Нокти", name_en: "Nails", description_bg: "Бързо подрязване", description_en: null, duration_mode: "fixed", fixed_duration_minutes: 15, fixed_price_cents: 1500, service_variants: [] } as unknown as Service;
const sized = {
  id: "2", name_bg: "Пълна грижа", name_en: null, description_bg: null, description_en: null, duration_mode: "size_based",
  service_variants: [
    { id: "a", label_bg: "Малко куче", label_en: "Small dog", price_cents: 3000, duration_minutes: 30, display_order: 1 },
    { id: "b", label_bg: "Голямо куче", label_en: null, price_cents: 5000, duration_minutes: 120, display_order: 2 },
  ],
} as unknown as Service;

test("services JSON-LD: fixed price becomes one Offer with 2-decimals price", () => {
  const ld = servicesJsonLd("bg", [fixed], "EUR", "Студио") as unknown as List;
  const item = ld.itemListElement[0].item;
  assert.equal(item.name, "Нокти");
  assert.deepEqual(item.offers, [{ "@type": "Offer", priceCurrency: "EUR", price: "15.00" }]);
  assert.equal(item.provider.name, "Студио");
});
test("services JSON-LD: size-based service lists one Offer per size, English falls back to Bulgarian", () => {
  const ld = servicesJsonLd("en", [sized], "EUR", "Studio") as unknown as List;
  const item = ld.itemListElement[0].item;
  assert.equal(item.name, "Пълна грижа");
  assert.deepEqual(item.offers.map((o) => [o.name, o.price]), [["Small dog", "30.00"], ["Голямо куче", "50.00"]]);
  assert.equal(item.description, undefined);
});
test("site JSON-LD has WebSite and Organization with absolute URLs", () => {
  const [site, org] = siteJsonLd("en", "Magic Paws") as unknown as Record<string, string>[];
  assert.equal(site["@type"], "WebSite");
  assert.equal(site.inLanguage, "en");
  assert.match(site.url, /^https?:\/\/.+\/en$/);
  assert.equal(org["@type"], "Organization");
  assert.match(org.logo, /\/icon\.png$/);
});
