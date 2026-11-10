import { cn } from "@/lib/utils";

/** Studio emblem (shield with paw), supplied by the owner. */
export function Logo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small static emblem
    <img src="/logo.png" alt="" width={83} height={72} className={cn("footer-art-mask h-11 w-auto", className)} />
  );
}
