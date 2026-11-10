"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { MediaImg } from "./media-img";

export interface GalleryItem { id: string; src: string; alt: string; caption: string }

/** Thumbnail grid + accessible lightbox (native <dialog>: focus trap, Esc, backdrop). */
export function GalleryGrid({ items, large = false }: { items: GalleryItem[]; large?: boolean }) {
  const t = useTranslations("content");
  const ref = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState<number | null>(null);
  const touchX = useRef<number | null>(null);
  const active = index === null ? null : items[index];
  const many = items.length > 1;
  const go = (step: number) => setIndex((i) => (i === null ? i : (i + step + items.length) % items.length));

  return (
    <>
      <ul className={large ? "grid grid-cols-2 gap-4 md:grid-cols-4" : "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"}>
        {items.map((it, i) => (
          <li key={it.id}>
            <button
              type="button"
              aria-label={`${t("openImage")}: ${it.alt || it.caption}`}
              onClick={() => { setIndex(i); ref.current?.showModal(); }}
              className="block w-full cursor-zoom-in overflow-hidden rounded-2xl border-2 border-gold-600/50 shadow-lg shadow-burgundy-900/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
            >
              <MediaImg src={it.src} alt={it.alt} className="aspect-[4/5] w-full object-cover object-top transition-transform duration-500 motion-safe:hover:scale-105" />
            </button>
          </li>
        ))}
      </ul>
      <dialog
        ref={ref}
        onClose={() => setIndex(null)}
        onClick={(e) => e.target === ref.current && ref.current?.close()}
        onKeyDown={(e) => {
          if (!many) return;
          if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
          if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
        }}
        className="m-auto max-h-[92vh] max-w-[92vw] rounded-xl bg-burgundy-900 p-3 text-parchment-50 backdrop:bg-black/70"
      >
        {active && (
          <figure
            onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => {
              if (touchX.current === null || !many) return;
              const dx = e.changedTouches[0].clientX - touchX.current;
              touchX.current = null;
              if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
            }}
          >
            <MediaImg src={active.src} alt={active.alt} className="max-h-[75vh] max-w-full rounded-lg object-contain" />
            {active.caption && <figcaption className="mt-2 text-center">{active.caption}</figcaption>}
            {many && index !== null && (
              <p className="mt-2 text-center text-sm text-cream-50" aria-live="polite">{index + 1} / {items.length}</p>
            )}
          </figure>
        )}
        {many && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label={t("prevImage")} className="absolute left-2 top-1/2 inline-flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-gold-400 text-burgundy-900 shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-parchment-50">
              <ChevronLeft aria-hidden="true" className="size-6" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label={t("nextImage")} className="absolute right-2 top-1/2 inline-flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-gold-400 text-burgundy-900 shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-parchment-50">
              <ChevronRight aria-hidden="true" className="size-6" />
            </button>
          </>
        )}
        <button type="button" onClick={() => ref.current?.close()} className="absolute right-2 top-2 inline-flex size-11 items-center justify-center rounded-full bg-gold-400 text-burgundy-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-parchment-50" aria-label={t("closeImage")}>
          <X aria-hidden="true" className="size-5" />
        </button>
      </dialog>
    </>
  );
}
