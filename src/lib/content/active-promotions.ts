import type { Promotion } from "./types.ts";

/** A promotion is shown when today is inside its optional [starts_at, ends_at] window. */
export function isActivePromotion(p: Pick<Promotion, "starts_at" | "ends_at">, now: Date): boolean {
  if (p.starts_at && new Date(p.starts_at) > now) return false;
  if (p.ends_at && new Date(p.ends_at) < now) return false;
  return true;
}
