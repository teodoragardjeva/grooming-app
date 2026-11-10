import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { PageHero, PageSection } from "@/components/page-hero";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <>
      <PageHero title={t("title")} />
      <PageSection>
        <p className="text-lg">{t("text")}</p>
        <Button asChild variant="burgundy" className="mt-6">
          <Link href="/">{t("back")}</Link>
        </Button>
      </PageSection>
    </>
  );
}
