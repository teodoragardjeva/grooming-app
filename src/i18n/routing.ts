import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["bg", "en"],
  defaultLocale: "bg",
  // Bulgarian at "/", English at "/en/..."
  localePrefix: "as-needed",
  // Predictable URLs: "/" is always Bulgarian; the visitor switches language explicitly (BG | EN).
  localeDetection: false,
});

export type AppLocale = (typeof routing.locales)[number];
