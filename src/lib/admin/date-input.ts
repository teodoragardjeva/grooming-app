// Pure helpers for the admin date/time text fields (dd/mm/yyyy and 24-hour HH:mm). Native <input type="date"|"time">
// follow the browser's locale (mm/dd/yyyy, AM/PM in en-US), so the admin uses text fields with a fixed format.

/** Digits typed so far -> "dd/mm/yyyy" with slashes inserted (max 8 digits). */
export function maskDmy(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** Digits typed so far -> "HH:mm" with the colon inserted (max 4 digits). */
export function maskHm(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`;
}

/** "dd/mm/yyyy" -> "yyyy-mm-dd", or null when it is not a real calendar date. */
export function dmyToIso(text: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!m) return null;
  const day = Number(m[1]), month = Number(m[2]), year = Number(m[3]);
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (year < 1000 || dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** "yyyy-mm-dd" -> "dd/mm/yyyy" ("" when empty or malformed). */
export function isoToDmy(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** "HH:mm" (24 h) -> the same string when valid, otherwise null. */
export function validHm(text: string): string | null {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : null;
}
