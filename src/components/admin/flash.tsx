"use client";

import { useEffect, useRef } from "react";

/** Result banner after an admin action. Sticky so it stays visible, and scrolled into view when it appears. */
export function Flash({ ok, err }: { ok?: string; err?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [ok, err]);
  if (!ok && !err) return null;
  const base = "sticky top-2 z-30 mb-4 rounded-lg border p-3 font-semibold shadow-md";
  return err
    ? <p ref={ref} role="alert" className={`${base} border-red-300 bg-red-100 text-red-900`}>{err}</p>
    : <p ref={ref} role="status" className={`${base} border-green-300 bg-green-100 text-green-900`}>✓ {ok}</p>;
}
export const fieldCls = "mt-1 w-full rounded-lg border border-burgundy-800/40 bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500";
