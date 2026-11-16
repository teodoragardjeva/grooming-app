import { STUDIO_TIMEZONE } from "../time/zone.ts";

const bg = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("bg-BG", { timeZone: STUDIO_TIMEZONE, ...o });
export const fmtTime = (iso: string | Date) => bg({ hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
/** "dd/mm/yyyy HH:mm" in the studio time zone. */
export const fmtDateTime = (iso: string | Date) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: STUDIO_TIMEZONE, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  );
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
};
export const fmtDay = (isoDate: string) => new Intl.DateTimeFormat("bg-BG", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${isoDate}T12:00:00Z`));
/** Short weekday + "dd/mm", e.g. "пн 16/11". */
export const fmtDayShort = (isoDate: string) => {
  const d = new Date(`${isoDate}T12:00:00Z`);
  const weekday = new Intl.DateTimeFormat("bg-BG", { weekday: "short", timeZone: "UTC" }).format(d);
  return `${weekday} ${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}`;
};
export const fmtMoney = (cents: number, currency: string) => new Intl.NumberFormat("bg-BG", { style: "currency", currency }).format(cents / 100);
