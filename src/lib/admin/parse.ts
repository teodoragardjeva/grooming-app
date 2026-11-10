export const str = (fd: FormData, k: string): string | null => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
};
export const int = (fd: FormData, k: string): number | null => {
  const v = str(fd, k);
  if (v == null) return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
};
/** "12,50" / "12.5" EUR → integer cents (NaN if invalid). */
export const cents = (fd: FormData, k: string): number | null => {
  const v = str(fd, k);
  if (v == null) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
};
export const eur = (c: number | null | undefined): string => (c == null ? "" : (c / 100).toFixed(2));
