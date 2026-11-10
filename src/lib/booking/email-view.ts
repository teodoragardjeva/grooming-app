import type { BookingView, Locale, StudioInfo } from "../email/templates.ts";
import type { BookingDeps } from "./deps.ts";

export interface EmailView {
  appointmentId: string;
  locale: Locale;
  to: string | null;
  booking: BookingView;
  studio: StudioInfo;
  ttlMinutes: number;
  reason: string | null;
  status: string;
}

interface RawView {
  ok: boolean;
  appointment: Record<string, string | number | null>;
  studio: Record<string, string | boolean | null>;
  ttl_minutes: number;
}

export async function loadEmailView(deps: BookingDeps, appointmentId: string): Promise<EmailView | null> {
  const raw = await deps.rpc<RawView>("appointment_email_view", { p_id: appointmentId });
  if (!raw?.ok) return null;
  const a = raw.appointment;
  const locale: Locale = a.locale === "en" ? "en" : "bg";
  const pickText = (bg: unknown, en: unknown) =>
    locale === "en" && typeof en === "string" && en.trim() ? en : ((bg as string | null) ?? "");
  const s = raw.studio;
  return {
    appointmentId,
    locale,
    to: (a.customer_email as string | null) ?? null,
    status: String(a.status),
    reason: (a.cancellation_reason as string | null) ?? null,
    ttlMinutes: raw.ttl_minutes,
    studio: {
      name: pickText(s.name_bg, s.name_en) || "Магически Лапички",
      phone: s.phone as string | null,
      email: s.email as string | null,
      address: pickText(s.address_bg, s.address_en) || null,
    },
    booking: {
      serviceName: pickText(a.service_name_bg, a.service_name_en),
      variantLabel: pickText(a.variant_label_bg, a.variant_label_en) || null,
      startAt: new Date(String(a.start_at)),
      durationMinutes: Number(a.duration_minutes),
      priceCents: Number(a.price_cents),
      currency: String(a.currency),
      customerName: String(a.customer_name),
      dogName: (a.dog_name as string | null) ?? null,
    },
  };
}
