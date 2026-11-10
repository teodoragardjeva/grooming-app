import { getTranslations } from "next-intl/server";
import { PageHero, PageSection } from "@/components/page-hero";
import type { Locale } from "@/lib/content/types";
import { paragraphs, pick } from "@/lib/content/locale";
import { getSiteContent } from "@/lib/content/queries";

export type LegalKey = "privacy" | "terms" | "cookies";

/** Admin-edited text (site_content `legal.<key>`) wins; otherwise a clearly-marked draft template. */
export async function LegalPage({ page, locale }: { page: LegalKey; locale: Locale }) {
  const t = await getTranslations();
  const row = (await getSiteContent([`legal.${page}`]))[`legal.${page}`];
  const custom = pick(locale, row?.content_bg, row?.content_en);
  const paras = custom ? paragraphs(custom) : (t.raw(`legal.${page}`) as string[]);
  return (
    <>
      <PageHero title={t(`pages.${page}.title`)} intro={t(`pages.${page}.intro`)} />
      <PageSection>
        <div className="max-w-3xl space-y-4 text-lg">
          {!custom && <p className="rounded-lg bg-gold-400/30 p-3 text-base font-semibold">{t("legal.draftNotice")}</p>}
          {paras.map((p, i) => <p key={i}>{p}</p>)}
        </div>
      </PageSection>
    </>
  );
}
