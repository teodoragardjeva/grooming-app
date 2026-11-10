import { cn } from "@/lib/utils";

const SPARKLES: ReadonlyArray<{ top: string; left: string; size: number; delay: string }> = [
  { top: "12%", left: "8%", size: 14, delay: "0s" },
  { top: "22%", left: "88%", size: 20, delay: "1.2s" },
  { top: "48%", left: "46%", size: 10, delay: "2.1s" },
  { top: "68%", left: "92%", size: 12, delay: "0.6s" },
  { top: "74%", left: "14%", size: 16, delay: "1.8s" },
  { top: "8%", left: "58%", size: 12, delay: "2.7s" },
];

/** Decorative gold sparkles. Purely visual; animation stops with prefers-reduced-motion. */
export function Sparkles({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0", className)}>
      {SPARKLES.map((s, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          width={s.size}
          height={s.size}
          className="absolute animate-twinkle fill-gold-400"
          style={{ top: s.top, left: s.left, animationDelay: s.delay }}
        >
          <path d="M12 0c.8 6.6 3.4 9.2 12 12-8.6 2.8-11.2 5.4-12 12-.8-6.6-3.4-9.2-12-12 8.6-2.8 11.2-5.4 12-12z" />
        </svg>
      ))}
    </div>
  );
}

/** Original generic castle silhouette (towers with pointed roofs), tiled to any width. */
export function CastleSilhouette({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width="100%"
      height="160"
      className={cn("pointer-events-none absolute inset-x-0 bottom-0 fill-burgundy-700/60", className)}
    >
      <defs>
        <pattern id="castle-tile" width="600" height="160" patternUnits="userSpaceOnUse">
          <path d="M0 160V120h40V90l10-26 10 26v30h40V100h30V70l12-34 12 34v30h28V120h40V84l10-30 10 30v36h50V96h24V50l14-40 14 40v46h24V120h36V76l10-24 10 24v44h46V104h26V66l12-30 12 30v38h34V122h40V90l10-26 10 26v32h48V160z" />
        </pattern>
      </defs>
      <rect width="100%" height="160" fill="url(#castle-tile)" style={{ fill: "url(#castle-tile)" }} />
    </svg>
  );
}
