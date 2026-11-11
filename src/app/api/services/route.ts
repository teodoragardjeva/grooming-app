import { guarded, json } from "@/lib/api/http";
import { getServices } from "@/lib/content/queries";

export const dynamic = "force-dynamic";

// Public: bookable services with their size variants (ids are needed by /api/availability and /api/booking).
// Only active, booking-enabled services and active variants are exposed; no customer data.
export function GET() {
  return guarded(async () => {
    const services = (await getServices()).filter((s) => s.booking_enabled);
    return json({
      ok: true,
      services: services.map((s) => ({
        id: s.id,
        nameBg: s.name_bg,
        nameEn: s.name_en,
        descriptionBg: s.description_bg,
        descriptionEn: s.description_en,
        durationMode: s.duration_mode, // "fixed" => no variant needed; "size_based" => variantId required
        fixedDurationMinutes: s.fixed_duration_minutes,
        fixedPriceCents: s.fixed_price_cents,
        variants: s.service_variants.map((v) => ({
          id: v.id,
          sizeKey: v.size_key,
          labelBg: v.label_bg,
          labelEn: v.label_en,
          durationMinutes: v.duration_minutes,
          priceCents: v.price_cents,
        })),
      })),
    });
  });
}
