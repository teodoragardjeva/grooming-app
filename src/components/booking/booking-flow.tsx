"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { DayPicker } from "react-day-picker";
import { bg as dpBg, enGB as dpEn } from "react-day-picker/locale";
import "react-day-picker/style.css";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { bookingFormSchema } from "@/lib/booking/schemas";
import type { BookingService, SlotDto } from "./types";

const TZ = "Europe/Sofia";
const nowMs = () => Date.now();
const detailsSchema = bookingFormSchema.pick({ name: true, phone: true, email: true, dogName: true, notes: true, consent: true });
type DetailsInput = z.input<typeof detailsSchema>;

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseYmd = (s: string) => new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));

interface Props {
  services: BookingService[];
  currency: string;
  horizonDays: number;
  holdMinutes: number;
  turnstileSiteKey?: string;
  initialServiceId?: string;
}

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, o: { sitekey: string; callback: (t: string) => void }) => void };
  }
}

export function BookingFlow({ services, currency, horizonDays, holdMinutes, turnstileSiteKey, initialServiceId }: Props) {
  const t = useTranslations("booking");
  const te = useTranslations("errors");
  const locale = useLocale() as "bg" | "en";
  const money = useMemo(
    () => new Intl.NumberFormat(locale === "bg" ? "bg-BG" : "en-GB", { style: "currency", currency }),
    [locale, currency],
  );
  const errMsg = (code: string) => (te.has(code as never) ? te(code as never) : te("internal"));

  const [serviceId, setServiceId] = useState(initialServiceId ?? "");
  const [variantId, setVariantId] = useState("");
  const [date, setDate] = useState<string | null>(null);
  const [month, setMonth] = useState<Date>(new Date());
  const [daysData, setDaysData] = useState<{ key: string; set: Set<string> } | null>(null);
  const [slotData, setSlotData] = useState<{ key: string; list: SlotDto[] } | null>(null);
  const [reload, setReload] = useState(0);
  const [slot, setSlot] = useState<SlotDto | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState<{ email: string; expiresAt: number } | null>(null);
  const [now, setNow] = useState(() => nowMs());
  const [token, setToken] = useState("");
  const tsRef = useRef<HTMLDivElement>(null);

  const service = services.find((s) => s.id === serviceId);
  const variant = service?.variants.find((v) => v.id === variantId);
  const ready = !!service && (service.variants.length === 0 || !!variant);
  const priceCents = variant?.priceCents ?? service?.priceCents ?? null;
  const minutes = variant?.durationMinutes ?? service?.durationMinutes ?? null;

  const daysKey = `${serviceId}|${variantId}|${month.getFullYear()}-${month.getMonth()}|${reload}`;
  const days = daysData?.key === daysKey ? daysData.set : new Set<string>();
  const slotKey = `${serviceId}|${variantId}|${date}|${reload}`;
  const slots = slotData?.key === slotKey ? slotData.list : null;

  const fmtTime = useCallback(
    (iso: string) => new Intl.DateTimeFormat(locale === "bg" ? "bg-BG" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(iso)),
    [locale],
  );
  const fmtDate = (s: string) =>
    new Intl.DateTimeFormat(locale === "bg" ? "bg-BG" : "en-GB", { weekday: "long", day: "numeric", month: "long" }).format(parseYmd(s));

  const form = useForm<DetailsInput>({
    resolver: zodResolver(detailsSchema),
    defaultValues: { name: "", phone: "", email: "", dogName: "", notes: "", consent: undefined },
  });

  const pickService = (id: string) => { setServiceId(id); setVariantId(""); setDate(null); setSlot(null); };
  const pickVariant = (id: string) => { setVariantId(id); setDate(null); setSlot(null); };

  // Which days of the visible month have free slots.
  useEffect(() => {
    if (!ready) return;
    const from = new Date(month.getFullYear(), month.getMonth(), 1);
    const to = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const ctrl = new AbortController();
    const q = new URLSearchParams({ service: serviceId, from: ymd(from), to: ymd(to) });
    if (variantId) q.set("variant", variantId);
    fetch(`/api/availability/days?${q}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((r) => (r.ok ? setDaysData({ key: daysKey, set: new Set<string>(r.days) }) : setServerError(r.error)))
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [ready, serviceId, variantId, month, daysKey]);

  // Slots for the chosen date.
  useEffect(() => {
    if (!ready || !date) return;
    const ctrl = new AbortController();
    const q = new URLSearchParams({ service: serviceId, date });
    if (variantId) q.set("variant", variantId);
    fetch(`/api/availability?${q}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((r) => (r.ok ? setSlotData({ key: slotKey, list: r.slots }) : setServerError(r.error)))
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [ready, serviceId, variantId, date, slotKey]);

  // Hold countdown.
  useEffect(() => {
    if (!done) return;
    const id = setInterval(() => setNow(nowMs()), 1000);
    return () => clearInterval(id);
  }, [done]);

  // Optional Turnstile.
  useEffect(() => {
    if (!turnstileSiteKey || !slot) return;
    const render = () => {
      if (tsRef.current && window.turnstile && !tsRef.current.hasChildNodes()) window.turnstile.render(tsRef.current, { sitekey: turnstileSiteKey, callback: setToken });
    };
    if (window.turnstile) { render(); return; }
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    s.async = true;
    s.onload = render;
    document.head.appendChild(s);
  }, [turnstileSiteKey, slot]);

  async function onSubmit(values: DetailsInput) {
    if (!slot || !service) return;
    setServerError(null);
    const form_ = document.getElementById("booking-form") as HTMLFormElement | null;
    const honeypot = (form_?.elements.namedItem("website") as HTMLInputElement | null)?.value ?? "";
    const res = await fetch("/api/booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        serviceId,
        variantId: variantId || null,
        startAt: slot.start,
        locale,
        website: honeypot,
        turnstileToken: token || undefined,
      }),
    }).then((r) => r.json()).catch(() => ({ ok: false, error: "internal" }));
    if (res.ok) {
      setDone({ email: values.email, expiresAt: res.holdExpiresAt ? new Date(res.holdExpiresAt).getTime() : nowMs() + holdMinutes * 60_000 });
      setNow(nowMs());
    } else {
      setServerError(res.error);
      if (res.error === "slot_taken") { setSlot(null); setReload((n) => n + 1); }
    }
  }

  const reset = () => { setDone(null); setSlot(null); setDate(null); setServerError(null); form.reset(); };

  if (services.length === 0) return <p className="rounded-2xl bg-parchment-100 p-6">{t("noServices")}</p>;

  if (done) {
    const left = Math.max(0, Math.floor((done.expiresAt - now) / 1000));
    const mm = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
    return (
      <div className="rounded-2xl bg-parchment-100 p-6 sm:p-8" role="status">
        <h2 className="text-3xl text-burgundy-900">{t("checkEmailTitle")}</h2>
        <p className="mt-3 text-lg">{t("checkEmailBody", { email: done.email, minutes: holdMinutes })}</p>
        <p className="mt-3 rounded-lg border border-gold-600/50 bg-gold-100 p-3 text-burgundy-900">{t("checkEmailSpam")}</p>
        {left > 0 ? (
          <p className="mt-4 font-semibold text-burgundy-800" aria-live="off">{t("holdCountdown", { time: mm })}</p>
        ) : (
          <>
            <p className="mt-4 text-burgundy-800">{t("holdExpired")}</p>
            <Button className="mt-4" onClick={reset}>{t("startOver")}</Button>
          </>
        )}
      </div>
    );
  }

  const today = new Date();
  const last = new Date(today.getFullYear(), today.getMonth(), today.getDate() + horizonDays);
  const field = "mt-1 w-full rounded-lg border border-burgundy-800/40 bg-white px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500";
  const err = (m?: string) => (m ? <p className="mt-1 text-sm text-red-800" role="alert">{te.has(m as never) ? te(m as never) : m}</p> : null);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-8">
        <fieldset>
          <legend className="text-2xl text-burgundy-900">1. {t("chooseService")}</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {services.map((s) => (
              <label key={s.id} className={`cursor-pointer rounded-xl border-2 p-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold-500 ${serviceId === s.id ? "border-burgundy-800 bg-parchment-100" : "border-burgundy-800/20 bg-white"}`}>
                <input type="radio" name="service" className="sr-only" checked={serviceId === s.id} onChange={() => pickService(s.id)} />
                <span className="block text-lg font-semibold">{s.name}</span>
                {s.description && <span className="mt-1 block text-sm text-burgundy-900/80">{s.description}</span>}
              </label>
            ))}
          </div>
        </fieldset>

        {service && service.variants.length > 0 && (
          <fieldset>
            <legend className="text-xl text-burgundy-900">{t("chooseSize")}</legend>
            <div className="mt-3 flex flex-wrap gap-3">
              {service.variants.map((v) => (
                <label key={v.id} className={`cursor-pointer rounded-xl border-2 px-4 py-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold-500 ${variantId === v.id ? "border-burgundy-800 bg-parchment-100" : "border-burgundy-800/20 bg-white"}`}>
                  <input type="radio" name="variant" className="sr-only" checked={variantId === v.id} onChange={() => pickVariant(v.id)} />
                  <span className="block font-semibold">{v.label}</span>
                  <span className="text-sm">{t("duration", { minutes: v.durationMinutes })} · {money.format(v.priceCents / 100)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {ready && (
          <section aria-labelledby="date-h">
            <h2 id="date-h" className="text-2xl text-burgundy-900">2. {t("chooseDate")}</h2>
            <div className="mt-3 inline-block rounded-xl bg-white p-3">
              <DayPicker
                mode="single"
                locale={locale === "bg" ? dpBg : dpEn}
                selected={date ? parseYmd(date) : undefined}
                onSelect={(d) => { setDate(d ? ymd(d) : null); setSlot(null); }}
                month={month}
                onMonthChange={setMonth}
                startMonth={new Date(today.getFullYear(), today.getMonth())}
                endMonth={new Date(last.getFullYear(), last.getMonth())}
                disabled={(d) => !days.has(ymd(d))}
              />
            </div>
            {date && (
              <div className="mt-4" aria-live="polite">
                <h3 className="text-xl text-burgundy-900">{t("chooseTime", { date: fmtDate(date) })}</h3>
                {slots === null ? (
                  <p className="mt-2 inline-flex items-center gap-2" role="status"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />{t("loadingSlots")}</p>
                ) : slots.filter((s) => s.available).length === 0 ? (
                  <p className="mt-2">{t("noSlots")}</p>
                ) : (
                  <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {slots.map((s) => (
                      <li key={s.start}>
                        <button
                          type="button"
                          disabled={!s.available}
                          aria-pressed={slot?.start === s.start}
                          onClick={() => setSlot(s)}
                          className={`w-full rounded-lg border-2 px-2 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 disabled:cursor-not-allowed disabled:border-transparent disabled:bg-parchment-200 disabled:text-burgundy-900/60 disabled:line-through ${slot?.start === s.start ? "border-burgundy-800 bg-burgundy-800 text-parchment-50" : "border-burgundy-800/40 bg-white"}`}
                        >
                          {fmtTime(s.start)}
                          {!s.available && <span className="sr-only"> – {t("unavailable")}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        )}

        {slot && (
          <form id="booking-form" onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4" aria-labelledby="details-h">
            <h2 id="details-h" className="text-2xl text-burgundy-900">3. {t("stepDetails")}</h2>
            <div>
              <label htmlFor="name">{t("name")}</label>
              <input id="name" autoComplete="name" className={field} aria-invalid={!!form.formState.errors.name} {...form.register("name")} />
              {err(form.formState.errors.name?.message)}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="phone">{t("phone")}</label>
                <input id="phone" type="tel" autoComplete="tel" className={field} aria-invalid={!!form.formState.errors.phone} {...form.register("phone")} />
                {err(form.formState.errors.phone?.message)}
              </div>
              <div>
                <label htmlFor="email">{t("email")}</label>
                <input id="email" type="email" autoComplete="email" className={field} aria-invalid={!!form.formState.errors.email} {...form.register("email")} />
                {err(form.formState.errors.email?.message)}
              </div>
            </div>
            <div>
              <label htmlFor="dogName">{t("dogName")}</label>
              <input id="dogName" className={field} {...form.register("dogName")} />
              {err(form.formState.errors.dogName?.message)}
            </div>
            <div>
              <label htmlFor="notes">{t("notes")}</label>
              <textarea id="notes" rows={3} className={field} {...form.register("notes")} />
              {err(form.formState.errors.notes?.message)}
            </div>
            {/* Honeypot: hidden from people and assistive tech; bots fill it. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
            </div>
            <div>
              <label className="flex items-start gap-3">
                <input type="checkbox" className="mt-1 size-5 accent-burgundy-800" aria-invalid={!!form.formState.errors.consent} {...form.register("consent")} />
                <span>{t.rich("consent", { privacy: () => <Link href="/legal/privacy" className="underline">{t("privacyLink")}</Link> })}</span>
              </label>
              {err(form.formState.errors.consent?.message)}
            </div>
            {turnstileSiteKey && <div ref={tsRef} />}
            {serverError && <p className="rounded-lg bg-red-100 p-3 text-red-900" role="alert">{errMsg(serverError)}</p>}
            <Button type="submit" loading={form.formState.isSubmitting}>{form.formState.isSubmitting ? t("submitting") : t("submit")}</Button>
          </form>
        )}
        {!slot && serverError && <p className="rounded-lg bg-red-100 p-3 text-red-900" role="alert">{errMsg(serverError)}</p>}
      </div>

      <aside className="h-fit rounded-2xl bg-parchment-100 p-5 lg:sticky lg:top-24" aria-label={t("selectedSummary")}>
        <h2 className="text-xl text-burgundy-900">{t("selectedSummary")}</h2>
        <dl className="mt-3 space-y-2 text-sm">
          {service && (<div><dt className="font-semibold">{t("summary.service")}</dt><dd>{service.name}{variant ? ` · ${variant.label}` : ""}</dd></div>)}
          {slot && date && (<div><dt className="font-semibold">{t("summary.when")}</dt><dd>{fmtDate(date)}, {fmtTime(slot.start)}{minutes ? ` (${t("duration", { minutes })})` : ""}</dd></div>)}
          {priceCents != null && (<div><dt className="font-semibold">{t("summary.price")}</dt><dd>{money.format(priceCents / 100)}</dd></div>)}
        </dl>
        <p className="mt-4 text-sm">{t("payment")}</p>
      </aside>
    </div>
  );
}
