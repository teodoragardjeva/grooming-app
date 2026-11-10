// Bilingual (bg/en) transactional email templates. Pure functions: no sending, no I/O.
import { STUDIO_TIMEZONE } from "../time/zone.ts";

export type Locale = "bg" | "en";

export interface StudioInfo {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

export interface BookingView {
  serviceName: string;
  variantLabel?: string | null;
  startAt: Date;
  durationMinutes: number;
  priceCents: number;
  currency: string;
  customerName: string;
  dogName?: string | null;
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

const COPY = {
  bg: {
    greeting: (n: string) => `Здравейте, ${n},`,
    service: "Услуга", size: "Размер", when: "Дата и час", duration: "Продължителност",
    price: "Цена", dog: "Куче", payment: "Плащане на място в студиото",
    minutes: (m: number) => `${m} мин.`,
    confirmSubject: (s: string) => `Потвърдете часа си в ${s}`,
    confirmLead: (min: number) => `Получихме заявката ви. Часът е запазен временно за ${min} минути. Потвърдете го, като натиснете бутона по-долу.`,
    confirmButton: "Потвърди часа", confirmNote: "Ако не потвърдите навреме, часът се освобождава автоматично.",
    okSubject: (s: string) => `Часът ви в ${s} е потвърден`,
    okLead: "Часът ви е потвърден. Очакваме ви!",
    cancelHint: "Ако не можете да дойдете, можете да отмените часа безплатно до 24 часа преди началото:",
    cancelButton: "Отмени часа",
    cancelledSubject: (s: string) => `Часът ви в ${s} е отменен`,
    cancelledLead: "Часът ви е отменен.",
    reasonLabel: "Причина",
    reschedSubject: (s: string) => `Часът ви в ${s} е преместен`,
    reschedLead: "Студиото премести часа ви. Новите данни са:",
    contact: "Контакти", locale: "bg-BG",
  },
  en: {
    greeting: (n: string) => `Hello ${n},`,
    service: "Service", size: "Size", when: "Date and time", duration: "Duration",
    price: "Price", dog: "Dog", payment: "Payment at the studio",
    minutes: (m: number) => `${m} min`,
    confirmSubject: (s: string) => `Please confirm your appointment at ${s}`,
    confirmLead: (min: number) => `We received your request. Your time is held for ${min} minutes. Please confirm it using the button below.`,
    confirmButton: "Confirm appointment", confirmNote: "If you do not confirm in time, the slot is released automatically.",
    okSubject: (s: string) => `Your appointment at ${s} is confirmed`,
    okLead: "Your appointment is confirmed. We look forward to seeing you!",
    cancelHint: "If you cannot make it, you can cancel free of charge up to 24 hours before the start:",
    cancelButton: "Cancel appointment",
    cancelledSubject: (s: string) => `Your appointment at ${s} was cancelled`,
    cancelledLead: "Your appointment has been cancelled.",
    reasonLabel: "Reason",
    reschedSubject: (s: string) => `Your appointment at ${s} was rescheduled`,
    reschedLead: "The studio has moved your appointment. The new details are:",
    contact: "Contact", locale: "en-GB",
  },
} as const;

export function escapeHtml(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function formatMoney(cents: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(COPY[locale].locale, { style: "currency", currency }).format(cents / 100);
}

export function formatWhen(at: Date, locale: Locale, tz: string = STUDIO_TIMEZONE): string {
  return new Intl.DateTimeFormat(COPY[locale].locale, {
    timeZone: tz, weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(at);
}

function rows(b: BookingView, locale: Locale): [string, string][] {
  const c = COPY[locale];
  const r: [string, string][] = [[c.service, b.serviceName]];
  if (b.variantLabel) r.push([c.size, b.variantLabel]);
  if (b.dogName) r.push([c.dog, b.dogName]);
  r.push([c.when, formatWhen(b.startAt, locale)]);
  r.push([c.duration, c.minutes(b.durationMinutes)]);
  r.push([c.price, `${formatMoney(b.priceCents, b.currency, locale)} — ${c.payment}`]);
  return r;
}

function render(opts: {
  locale: Locale; studio: StudioInfo; subject: string; greeting: string; lead: string;
  booking?: BookingView; extraRows?: [string, string][]; button?: { label: string; url: string };
  footerNote?: string;
}): EmailContent {
  const c = COPY[opts.locale];
  const table = [...(opts.booking ? rows(opts.booking, opts.locale) : []), ...(opts.extraRows ?? [])];
  const contact = [opts.studio.name, opts.studio.address, opts.studio.phone, opts.studio.email].filter(Boolean) as string[];
  const text = [
    opts.greeting, "", opts.lead, "",
    ...table.map(([k, v]) => `${k}: ${v}`),
    ...(opts.button ? ["", `${opts.button.label}: ${opts.button.url}`] : []),
    ...(opts.footerNote ? ["", opts.footerNote] : []),
    "", `${c.contact}:`, ...contact,
  ].join("\n");
  const html = `<!doctype html><html lang="${opts.locale}"><body style="margin:0;background:#FBF6EA;font-family:Arial,Helvetica,sans-serif;color:#2A1A1F">
<div style="max-width:560px;margin:0 auto;padding:24px">
<div style="background:#3B0D1E;color:#D9B26A;padding:16px 24px;border-radius:12px 12px 0 0;font-size:20px">${escapeHtml(opts.studio.name)}</div>
<div style="background:#ffffff;padding:24px;border-radius:0 0 12px 12px">
<p>${escapeHtml(opts.greeting)}</p><p>${escapeHtml(opts.lead)}</p>
<table role="presentation" cellpadding="6" style="border-collapse:collapse;width:100%">${table
    .map(([k, v]) => `<tr><td style="color:#6B1D36;vertical-align:top">${escapeHtml(k)}</td><td><strong>${escapeHtml(v)}</strong></td></tr>`)
    .join("")}</table>
${opts.button ? `<p style="margin:24px 0"><a href="${escapeHtml(opts.button.url)}" style="background:#6B1D36;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">${escapeHtml(opts.button.label)}</a></p>` : ""}
${opts.footerNote ? `<p style="color:#555">${escapeHtml(opts.footerNote)}</p>` : ""}
<hr style="border:none;border-top:1px solid #eee"><p style="font-size:13px;color:#555">${contact.map(escapeHtml).join("<br>")}</p>
</div></div></body></html>`;
  return { subject: opts.subject, html, text };
}

export function confirmationRequestEmail(a: { locale: Locale; studio: StudioInfo; booking: BookingView; confirmUrl: string; ttlMinutes: number }): EmailContent {
  const c = COPY[a.locale];
  return render({ locale: a.locale, studio: a.studio, subject: c.confirmSubject(a.studio.name),
    greeting: c.greeting(a.booking.customerName), lead: c.confirmLead(a.ttlMinutes), booking: a.booking,
    button: { label: c.confirmButton, url: a.confirmUrl }, footerNote: c.confirmNote });
}

export function bookingConfirmedEmail(a: { locale: Locale; studio: StudioInfo; booking: BookingView; cancelUrl: string }): EmailContent {
  const c = COPY[a.locale];
  return render({ locale: a.locale, studio: a.studio, subject: c.okSubject(a.studio.name),
    greeting: c.greeting(a.booking.customerName), lead: c.okLead, booking: a.booking,
    button: { label: c.cancelButton, url: a.cancelUrl }, footerNote: c.cancelHint });
}

export function bookingCancelledEmail(a: { locale: Locale; studio: StudioInfo; booking: BookingView; reason?: string | null }): EmailContent {
  const c = COPY[a.locale];
  return render({ locale: a.locale, studio: a.studio, subject: c.cancelledSubject(a.studio.name),
    greeting: c.greeting(a.booking.customerName), lead: c.cancelledLead, booking: a.booking,
    extraRows: a.reason ? [[c.reasonLabel, a.reason]] : [] });
}

export function bookingRescheduledEmail(a: { locale: Locale; studio: StudioInfo; booking: BookingView }): EmailContent {
  const c = COPY[a.locale];
  return render({ locale: a.locale, studio: a.studio, subject: c.reschedSubject(a.studio.name),
    greeting: c.greeting(a.booking.customerName), lead: c.reschedLead, booking: a.booking });
}
