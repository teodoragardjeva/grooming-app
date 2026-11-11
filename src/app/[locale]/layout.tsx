import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import "@fontsource-variable/open-sans";
import "@fontsource-variable/eb-garamond";
import "../globals.css";
import { ChatBubble } from "@/components/chat/chat-bubble";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { resolveLocale, type LocaleParams } from "@/i18n/locale";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/seo/metadata";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: `${t("siteName")} | ${t("tagline")}`, template: `%s | ${t("siteName")}` },
    description: t("description"),
    openGraph: {
      siteName: t("siteName"),
      locale: locale === "bg" ? "bg_BG" : "en_GB",
      type: "website",
      images: [{ url: `/og-${locale}.png`, width: 1200, height: 630, alt: t("siteName") }],
    },
    twitter: { card: "summary_large_image", images: [`/og-${locale}.png`] },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleParams & { children: React.ReactNode }) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "common" });

  return (
    <html lang={locale}>
      <body className="flex min-h-screen flex-col">
        <NextIntlClientProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-gold-400 focus:px-4 focus:py-2 focus:font-semibold focus:text-burgundy-900"
          >
            {t("skipToContent")}
          </a>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter locale={locale as "bg" | "en"} />
          <ChatBubble />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
