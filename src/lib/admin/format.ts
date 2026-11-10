import { STUDIO_TIMEZONE } from "../time/zone.ts";

const bg = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("bg-BG", { timeZone: STUDIO_TIMEZONE, ...o });
export const fmtTime = (iso: string | Date) => bg({ hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
export const fmtDateTime = (iso: string | Date) => bg({ dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
export const fmtDay = (isoDate: string) => new Intl.DateTimeFormat("bg-BG", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${isoDate}T12:00:00Z`));
export const fmtDayShort = (isoDate: string) => new Intl.DateTimeFormat("bg-BG", { weekday: "short", day: "numeric", month: "numeric", timeZone: "UTC" }).format(new Date(`${isoDate}T12:00:00Z`));
export const fmtMoney = (cents: number, currency: string) => new Intl.NumberFormat("bg-BG", { style: "currency", currency }).format(cents / 100);
