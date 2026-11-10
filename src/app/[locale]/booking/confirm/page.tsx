import type { Metadata } from "next";
import { TokenPage } from "@/components/booking/token-page";
import { resolveLocale, type LocaleParams } from "@/i18n/locale";

export const dynamic = "force-dynamic";
// Tokenized pages must never be indexed or leak the token via Referer.
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function Page({ params, searchParams }: LocaleParams & { searchParams: Promise<{ token?: string }> }) {
  const locale = await resolveLocale(params);
  const { token } = await searchParams;
  return <TokenPage kind="confirm" locale={locale as "bg" | "en"} token={token} />;
}
