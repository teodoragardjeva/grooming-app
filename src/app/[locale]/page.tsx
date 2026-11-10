import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { HandHeart, Sparkles as SparklesIcon, FlaskConical, PawPrint, MailOpen, ArrowRight } from "lucide-react";
import { Sparkles } from "@/components/layout/decor";
import { Button } from "@/components/ui/button";
import { resolveLocale, type LocaleParams } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { staticGalleryItems } from "@/lib/content/photos";
import { Photo } from "@/components/content/photo";
import { ServiceCard } from "@/components/content/service-card";
import { PromoBanner } from "@/components/content/promo-banner";
import { GalleryGrid } from "@/components/content/gallery-grid";
import { JsonLd } from "@/components/seo/json-ld";
import { siteJsonLd } from "@/lib/seo/structured-data";
import { isActivePromotion } from "@/lib/content/active-promotions";
import { mediaUrl, pick } from "@/lib/content/locale";
import { getGallery, getPromotions, getServices, getSettings } from "@/lib/content/queries";
import { buildAlternates, siteUrl } from "@/lib/seo/metadata";

export const revalidate = 60;

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await resolveLocale(params);
  return { alternates: buildAlternates(locale, "/") };
}

const BENEFITS = [
  { key: "expert", Icon: HandHeart },
  { key: "individual", Icon: PawPrint },
  { key: "quality", Icon: FlaskConical },
  { key: "calm", Icon: SparklesIcon },
] as const;

const GALLERY_FALLBACK = ["yorkie-bow", "pomeranian-lap", "pomeranian-towel", "hero-dachshund"] as const;

export default async function HomePage({ params }: LocaleParams) {
  const locale = await resolveLocale(params);
  const t = await getTranslations("home");
  const tc = await getTranslations("common");
  const tn = await getTranslations("content");
  const tm = await getTranslations("meta");
  const th = await getTranslations("home2");
  const tp = await getTranslations("photos");
  const [services, gallery, allPromos, settings] = await Promise.all([getServices(), getGallery(8), getPromotions(), getSettings()]);
  const now = new Date();
  const promos = allPromos.filter((p) => isActivePromotion(p, now)).slice(0, 3);
  const galleryItems = gallery.flatMap((g) => {
    const src = mediaUrl(g.storage_path);
    if (!src) return [];
    const caption = pick(locale, g.caption_bg, g.caption_en);
    return [{ id: g.id, src, caption, alt: pick(locale, g.alt_bg, g.alt_en) || caption }];
  });

  const jsonLd = settings && !settings.is_example_data
    ? {
        "@context": "https://schema.org", "@type": "LocalBusiness",
        name: pick(locale, settings.studio_name_bg, settings.studio_name_en),
        telephone: settings.phone ?? undefined, email: settings.email ?? undefined,
        address: settings.address_bg ? pick(locale, settings.address_bg, settings.address_en) : undefined,
        url: siteUrl(),
      }
    : null;

  return (
    <>
      {siteJsonLd(locale, settings ? pick(locale, settings.studio_name_bg, settings.studio_name_en) : tm("siteName")).map((d, i) => <JsonLd key={i} data={d} />)}
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />}
      <section className="relative overflow-hidden bg-wine text-parchment-50 lg:min-h-[26rem]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_6%_25%,rgba(255,200,110,0.22),transparent_16%),radial-gradient(circle_at_40%_6%,rgba(255,200,110,0.14),transparent_14%)]"
        />
        <div className="relative mx-auto flex max-w-6xl flex-col px-4 pt-12 sm:px-6 lg:min-h-[26rem] lg:pt-16">
          <div className="relative z-10 max-w-xl pb-6 lg:pb-16">
            <p className="flex items-center gap-3 text-sm font-bold uppercase tracking-widest text-gold-400 before:h-px before:w-8 before:bg-gold-400/70 after:h-px after:w-8 after:bg-gold-400/70">{t("eyebrow")}</p>
            <h1 className="mt-4 text-4xl font-medium text-gold-100 sm:text-6xl">{t("title")}</h1>
            <p className="mt-4 text-lg text-cream-50">{t("text")}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/booking">{tc("book")} <ArrowRight aria-hidden="true" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/services">{t("secondaryCta")}</Link>
              </Button>
            </div>
          </div>
        </div>
        <Photo
          name="hero-banner"
          alt=""
          sizes="(min-width: 1024px) 60vw, 100vw"
          priority
          className="hero-art-mask relative block w-full lg:absolute lg:bottom-0 lg:right-0 lg:w-[62%]"
        />
        <Sparkles />
      </section>

      {promos.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-12 sm:px-6" aria-label={tn("promotionsTitle")}>
          <PromoBanner promo={promos[0]} locale={locale} />
          {promos.length > 1 && (
            <p className="mt-3 text-right"><Link href="/promotions" className="font-semibold text-heading underline underline-offset-4">{tn("allPromos")} →</Link></p>
          )}
        </section>
      )}

      {services.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-14 pb-12 sm:px-6">
          <h2 className="flex items-center gap-4 text-center text-3xl text-heading before:h-px before:flex-1 before:bg-gold-600/60 after:h-px after:flex-1 after:bg-gold-600/60 sm:text-4xl">{tn("popularServices")}</h2>
          <ul className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {services.slice(0, 3).map((sv) => (
              <li key={sv.id} className="flex"><ServiceCard service={sv} locale={locale} currency={settings?.currency ?? "EUR"} /></li>
            ))}
          </ul>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 pb-12 pt-12 sm:px-6" aria-labelledby="band-title">
        <div className="flex flex-col items-center gap-5 rounded-2xl border border-gold-600/50 bg-parchment-card p-6 shadow-md shadow-burgundy-900/15 sm:flex-row sm:gap-8 sm:px-10">
          <span aria-hidden="true" className="inline-flex size-20 shrink-0 items-center justify-center rounded-full bg-wine text-gold-400 shadow-md"><MailOpen className="size-9" /></span>
          <div className="flex-1 text-center sm:text-left">
            <h2 id="band-title" className="text-2xl text-heading sm:text-3xl">{th("ctaBand")}</h2>
            <p className="mt-2 max-w-2xl">{th("ctaBandText")}</p>
          </div>
          <Button asChild size="lg"><Link href="/booking">{tc("book")} <ArrowRight aria-hidden="true" /></Link></Button>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6" aria-labelledby="gal-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="gal-title" className="text-3xl text-heading sm:text-4xl">{tn("galleryTitle")}</h2>
          <Link href="/gallery" className="inline-flex min-h-11 items-center gap-1 font-semibold text-heading underline underline-offset-4">{tn("viewAll")} <ArrowRight aria-hidden="true" className="size-4" /></Link>
        </div>
        <div className="mt-6"><GalleryGrid large items={(galleryItems.length > 0 ? galleryItems : staticGalleryItems((k) => tp(k), GALLERY_FALLBACK)).slice(0, 4)} /></div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6" aria-label={t("benefitsTitle")}>
        <ul className="grid gap-6 rounded-2xl border border-gold-600/40 bg-parchment-100/60 p-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-gold-600/40">
          {BENEFITS.map(({ key, Icon }) => (
            <li key={key} className="flex items-start gap-4 lg:px-5">
              <Icon aria-hidden="true" className="size-10 shrink-0 text-burgundy-700" />
              <div>
                <h3 className="text-xl text-heading">{th(`benefit.${key}.title`)}</h3>
                <p className="mt-1 text-sm">{th(`benefit.${key}.text`)}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6" aria-labelledby="ba-title">
        <h2 id="ba-title" className="text-3xl text-heading sm:text-4xl">{th("baTitle")}</h2>
        <p className="mt-2 max-w-2xl">{th("baText")}</p>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {(["poodle-before-after", "yorkie-before-after"] as const).map((k) => (
            <figure key={k} className="overflow-hidden rounded-3xl border-2 border-gold-600/50 bg-white p-2 shadow-lg shadow-burgundy-900/10">
              <Photo name={k} alt={tp(k)} sizes="(min-width: 768px) 36rem, 92vw" className="aspect-[4/5] w-full rounded-2xl object-cover object-top" />
            </figure>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-[0.8fr_1.2fr]" aria-labelledby="about-title">
        <Photo name="groomer-towel" alt={tp("groomer-towel")} sizes="(min-width: 768px) 24rem, 80vw" className="mx-auto aspect-[4/5] w-full max-w-sm rounded-3xl object-cover shadow-xl md:mx-0" />
        <div>
          <h2 id="about-title" className="text-3xl text-heading sm:text-4xl">{th("aboutTitle")}</h2>
          <p className="mt-4 max-w-xl text-lg">{th("aboutText")}</p>
          <Button asChild variant="outlineLight" className="mt-6"><Link href="/about">{th("aboutCta")}</Link></Button>
        </div>
      </section>
    </>
  );
}
