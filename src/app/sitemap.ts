import type { MetadataRoute } from "next";
import { getLastModified } from "@/lib/content/queries";
import { siteUrl } from "@/lib/env";

export const revalidate = 3600;

const PATHS = ["/", "/services", "/about", "/gallery", "/promotions", "/contacts", "/booking", "/legal/privacy", "/legal/terms", "/legal/cookies"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl().replace(/\/$/, "");
  const url = (locale: "bg" | "en", p: string) => `${base}${locale === "en" ? "/en" : ""}${p === "/" ? (locale === "en" ? "" : "/") : p}`;
  const lm = await getLastModified();
  const newest = (...d: (Date | undefined)[]) => d.filter((x): x is Date => !!x).sort((a, b) => b.getTime() - a.getTime())[0];
  const lastModified: Record<string, Date | undefined> = {
    "/": newest(lm.services, lm.content, lm.settings),
    "/services": lm.services,
    "/about": lm.content,
    "/contacts": newest(lm.content, lm.settings),
  };
  return PATHS.map((p) => ({
    url: url("bg", p),
    ...(lastModified[p] ? { lastModified: lastModified[p] } : {}),
    alternates: { languages: { bg: url("bg", p), en: url("en", p) } },
  }));
}
