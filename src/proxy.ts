import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);

// /admin: noindex + no-store. Everything else: locale routing.
export default function proxy(req: NextRequest) {
  if (req.nextUrl.pathname === "/admin" || req.nextUrl.pathname.startsWith("/admin/")) {
    const res = NextResponse.next({ request: req });
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
  return intl(req);
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
