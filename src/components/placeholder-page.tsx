import { getTranslations } from "next-intl/server";
import { PageHero, PageSection } from "./page-hero";

export type PlaceholderKey =
  | "services"
  | "about"
  | "gallery"
  | "promotions"
  | "contacts"
  | "booking"
  | "privacy"
  | "terms"
  | "cookies";

/** Phase 1 shell: real content arrives with Phase 3 (database-backed pages). */
export async function PlaceholderPage({ page }: { page: PlaceholderKey }) {
  const t = await getTranslations();
  return (
    <>
      <PageHero title={t(`pages.${page}.title`)} intro={t(`pages.${page}.intro`)} />
      <PageSection>
        <p className="rounded-2xl bg-parchment-100 p-6 text-lg">{t("common.comingSoon")}</p>
      </PageSection>
    </>
  );
}
