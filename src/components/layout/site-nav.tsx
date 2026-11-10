"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";
import { LanguageSwitcher } from "./language-switcher";
import { Button } from "@/components/ui/button";

export function SiteNav() {
  const t = useTranslations();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile menu on Escape (link clicks close it via onClick).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const linkClass = (href: string) =>
    cn(
      "inline-flex min-h-11 items-center border-b-2 px-3 text-base font-semibold transition-colors hover:text-gold-300",
      (href === "/" ? pathname === "/" : pathname.startsWith(href))
        ? "border-gold-300 text-gold-300"
        : "border-transparent text-cream-50",
    );

  return (
    <>
      {/* Desktop */}
      <nav aria-label={t("nav.label")} className="hidden items-center gap-1 lg:flex">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={linkClass(item.href)}
            aria-current={(item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)) ? "page" : undefined}
          >
            {t(`nav.${item.key}`)}
          </Link>
        ))}
      </nav>
      <div className="hidden items-center gap-3 lg:flex">
        <LanguageSwitcher />
        <Button asChild size="sm">
          <Link href="/booking">{t("common.book")}</Link>
        </Button>
      </div>

      {/* Mobile */}
      <div className="flex items-center gap-2 lg:hidden">
        <LanguageSwitcher />
        <button
          type="button"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? t("nav.closeMenu") : t("nav.openMenu")}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex size-11 items-center justify-center rounded-full text-parchment-50 hover:text-gold-300"
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>
      {open && (
        <nav
          id="mobile-menu"
          aria-label={t("nav.label")}
          className="absolute inset-x-0 top-full z-40 border-t border-gold-400/30 bg-burgundy-900 px-4 pb-6 pt-3 lg:hidden"
        >
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className={cn(linkClass(item.href), "w-full")}
                  onClick={() => setOpen(false)}
                  aria-current={(item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)) ? "page" : undefined}
                >
                  {t(`nav.${item.key}`)}
                </Link>
              </li>
            ))}
          </ul>
          <Button asChild className="mt-4 w-full">
            <Link href="/booking" onClick={() => setOpen(false)}>{t("common.book")}</Link>
          </Button>
        </nav>
      )}
    </>
  );
}
