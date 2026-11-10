import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/booking/confirm", "/booking/cancel", "/en/booking/confirm", "/en/booking/cancel"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
