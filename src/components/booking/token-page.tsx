import { getTranslations } from "next-intl/server";
import { PageHero, PageSection } from "@/components/page-hero";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { createBookingDeps } from "@/lib/booking/runtime";
import { tokenSummary } from "@/lib/booking/public";
import { pick } from "@/lib/content/locale";
import { TokenAction } from "./token-action";

export async function TokenPage({ kind, locale, token }: { kind: "confirm" | "cancel"; locale: "bg" | "en"; token?: string }) {
  const t = await getTranslations();
  const te = await getTranslations("errors");
  const title = t(kind === "confirm" ? "booking.confirmTitle" : "booking.cancelTitle");

  let body: React.ReactNode;
  if (!token) {
    body = <p role="alert">{te("invalid_token")}</p>;
  } else {
    let summary: Awaited<ReturnType<typeof tokenSummary>> | null = null;
    try {
      summary = await tokenSummary(createBookingDeps(), kind, token);
    } catch {
      summary = null;
    }
    if (!summary) body = <p role="alert">{te("not_configured")}</p>;
    else if (!summary.ok) body = <p role="alert">{te(summary.error === "invalid_token" ? "invalid_token" : "internal")}</p>;
    else if (summary.tokenExpired && !summary.tokenUsed) body = <p role="alert">{te("expired")}</p>;
    else {
      const money = new Intl.NumberFormat(locale === "bg" ? "bg-BG" : "en-GB", { style: "currency", currency: summary.currency });
      const when = new Intl.DateTimeFormat(locale === "bg" ? "bg-BG" : "en-GB", {
        dateStyle: "full", timeStyle: "short", timeZone: "Europe/Sofia",
      }).format(new Date(summary.startAt));
      body = (
        <div className="max-w-xl space-y-6">
          <p className="text-lg">{t(kind === "confirm" ? "booking.confirmIntro" : "booking.cancelIntro")}</p>
          <dl className="space-y-2 rounded-2xl bg-parchment-100 p-5">
            <div><dt className="font-semibold">{t("booking.summary.service")}</dt>
              <dd>{pick(locale, summary.serviceName.bg, summary.serviceName.en)}{summary.variantLabel.bg ? ` · ${pick(locale, summary.variantLabel.bg, summary.variantLabel.en)}` : ""}</dd></div>
            <div><dt className="font-semibold">{t("booking.summary.when")}</dt><dd>{when}</dd></div>
            <div><dt className="font-semibold">{t("booking.summary.price")}</dt><dd>{money.format(summary.priceCents / 100)}</dd></div>
            {summary.dogName && <div><dt className="font-semibold">{t("booking.summary.dog")}</dt><dd>{summary.dogName}</dd></div>}
          </dl>
          <TokenAction kind={kind} token={token} />
        </div>
      );
    }
  }
  return (
    <>
      <PageHero title={title} />
      <PageSection>
        {body}
        <Button asChild variant="outlineLight" className="mt-8"><Link href="/">{t("nav.home")}</Link></Button>
      </PageSection>
    </>
  );
}
