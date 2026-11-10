import { formatPrice, pick, servicePriceCents } from "@/lib/content/locale";
import { getServices, getSettings } from "@/lib/content/queries";
import { siteUrl } from "@/lib/env";

export const revalidate = 3600;

/** llms.txt: a short, factual summary of the site for AI assistants (https://llmstxt.org). */
export async function GET() {
  const base = siteUrl();
  const [services, settings] = await Promise.all([getServices(), getSettings()]);
  const currency = settings?.currency ?? "EUR";
  const name = settings ? pick("bg", settings.studio_name_bg, settings.studio_name_en) : "Магически Лапички";
  const lines: string[] = [
    `# ${name} (Magic Paws)`,
    "",
    `> Dog grooming studio in Bulgaria with a wizard-school theme. Online booking; payment on site at the studio. Site languages: Bulgarian (default) and English.`,
    `> Студио за груминг на кучета в България с магическа атмосфера. Онлайн записване на час; плащане на място в студиото. Езици: български и английски.`,
    "",
    "## Pages",
    `- [Services / Услуги](${base}/services): all services with prices and durations`,
    `- [Book / Запази час](${base}/booking): online appointment booking`,
    `- [About / За нас](${base}/about)`,
    `- [Gallery / Галерия](${base}/gallery)`,
    `- [Promotions / Промоции](${base}/promotions)`,
    `- [Contacts / Контакти](${base}/contacts)`,
    `- [English version](${base}/en)`,
  ];
  if (services.length > 0) {
    lines.push("", "## Services (bg)");
    for (const s of services) {
      const price = servicePriceCents(s);
      const label = price ? `${price.isFrom ? "от " : ""}${formatPrice(price.cents, currency, "bg")}` : "";
      lines.push(`- ${pick("bg", s.name_bg, s.name_en)}${label ? `: ${label}` : ""}`);
    }
  }
  return new Response(lines.join("\n") + "\n", { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
