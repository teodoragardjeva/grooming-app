"use client";

import { useState } from "react";
import { Copy } from "lucide-react";

/** Copies the (up to 3) periods of one weekday into the next weekday's inputs. Not saved until the form is submitted. */
export function CopyDayButton({ from, to, label, doneLabel, ariaLabel }: { from: number; to: number; label: string; doneLabel: string; ariaLabel: string }) {
  const [done, setDone] = useState(false);
  function copy() {
    for (let k = 0; k < 3; k++) {
      for (const part of ["start", "end"] as const) {
        const src = document.getElementById(`w${from}_${k}_${part}`) as HTMLInputElement | null;
        const dst = document.getElementById(`w${to}_${k}_${part}`) as HTMLInputElement | null;
        if (src && dst) dst.value = src.value;
      }
    }
    setDone(true);
    window.setTimeout(() => setDone(false), 2000);
  }
  return (
    <button type="button" onClick={copy} aria-label={ariaLabel} className="mt-1 inline-flex min-h-9 items-center gap-1 rounded-md px-1 text-xs font-semibold text-heading underline underline-offset-4 hover:text-burgundy-700 focus-visible:outline-2 focus-visible:outline-gold-600">
      <Copy aria-hidden="true" className="size-3.5" /> {done ? doneLabel : label}
      <span role="status" className="sr-only">{done ? doneLabel : ""}</span>
    </button>
  );
}
