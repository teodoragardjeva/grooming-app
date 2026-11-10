import { getTranslations } from "next-intl/server";
import { JsonLd } from "./json-ld";

const KEYS = ["book", "payment", "cancel", "price", "noEmail"] as const;

/** Visible FAQ (accordion) plus matching FAQPage structured data. Facts come from the business settings. */
export async function Faq({ confirmMinutes, cancelHours }: { confirmMinutes: number; cancelHours: number }) {
  const t = await getTranslations("faq");
  const items = KEYS.map((k) => ({ q: t(`${k}.q`), a: t(`${k}.a`, { minutes: confirmMinutes, hours: cancelHours }) }));
  return (
    <section aria-labelledby="faq-h" className="mt-12">
      <h2 id="faq-h" className="text-3xl text-heading">{t("title")}</h2>
      <div className="mt-4 space-y-3">
        {items.map((it) => (
          <details key={it.q} className="group rounded-xl border border-gold-600/50 bg-parchment-card p-4 shadow-sm">
            <summary className="cursor-pointer list-none text-lg font-semibold text-heading marker:hidden focus-visible:outline-2 focus-visible:outline-gold-500">{it.q}</summary>
            <p className="mt-2">{it.a}</p>
          </details>
        ))}
      </div>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: items.map((it) => ({ "@type": "Question", name: it.q, acceptedAnswer: { "@type": "Answer", text: it.a } })),
        }}
      />
    </section>
  );
}
