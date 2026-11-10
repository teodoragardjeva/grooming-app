"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/layout/logo";
import { S } from "@/lib/admin/strings";
import { logoutAction } from "@/app/admin/login/actions";

const ITEMS = [
  ["/admin", S.nav.overview], ["/admin/calendar", S.nav.calendar], ["/admin/appointments/new", S.nav.newAppt],
  ["/admin/schedule", S.nav.schedule], ["/admin/services", S.nav.services], ["/admin/gallery", S.nav.gallery],
  ["/admin/promotions", S.nav.promotions], ["/admin/settings", S.nav.settings], ["/admin/content", S.nav.content], ["/admin/logs", S.nav.logs],
] as const;

export function AdminNav({ email }: { email: string | null }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  return (
    <header className="relative z-30 border-b border-gold-400/40 bg-wine text-parchment-50 shadow-lg shadow-black/30">
      {/* One row on wide screens: brand left, menu centre, account right. Narrower screens put the menu on a second row. */}
      <div className="mx-auto flex max-w-[110rem] flex-wrap items-center justify-between gap-x-6 px-4 py-1 min-[1760px]:flex-nowrap">
        <Link href="/admin" className="inline-flex min-h-11 shrink-0 items-center gap-3">
          <Logo />
          <span className="flex flex-col leading-tight">
            <span className="font-serif text-2xl font-bold text-gold-400">{S.brand}</span>
            <span className="text-xs text-cream-50">{S.adminTag}</span>
          </span>
        </Link>
        <nav aria-label="Админ навигация" className="order-3 -mx-2 flex w-full gap-x-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-wrap md:justify-center md:overflow-visible min-[1760px]:order-none min-[1760px]:w-auto min-[1760px]:flex-1 min-[1760px]:flex-nowrap">
          {ITEMS.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center whitespace-nowrap border-b-2 px-3 font-semibold min-[1760px]:px-2 transition-colors hover:text-gold-300",
                isActive(href) ? "border-gold-300 text-gold-300" : "border-transparent text-cream-50",
              )}
            >{label}</Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-x-4 text-sm">
          {/* Different root layout than the public site: a full page load is intended. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="underline-offset-4 hover:text-gold-300 hover:underline">{S.nav.site}</a>
          <form action={logoutAction} className="flex items-center gap-3">
            {email && <span className="hidden max-w-[14rem] truncate text-cream-50 sm:inline" title={email}>{email}</span>}
            <button className="min-h-9 rounded-full border-2 border-gold-400 px-3 font-semibold text-gold-400 hover:bg-gold-400 hover:text-burgundy-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400">{S.nav.logout}</button>
          </form>
        </div>
      </div>
    </header>
  );
}
