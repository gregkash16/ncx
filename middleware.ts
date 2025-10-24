// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Simple regex fallbacks (used if Client Hints not present)
const MOBILE_RE = /iPhone|Android.+Mobile|Windows Phone|webOS|BlackBerry/i;
const TABLET_RE = /iPad|Android(?!.*Mobile)/i; // tablets treated as desktop

function toMobilePath(pathname: string) {
  if (pathname === "/") return "/m";
  if (pathname.startsWith("/m")) return pathname; // already mobile
  return `/m${pathname}`;
}

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  const url = req.nextUrl.clone();

  // Ignore Next internals and assets
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/public") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap.xml")
  ) {
    return NextResponse.next();
  }

  // Respect explicit overrides (and set a cookie so it persists)
  const desktopOverride = searchParams.get("desktop") === "1";
  const mobileOverride = searchParams.get("mobile") === "1";

  if (desktopOverride) {
    const res = NextResponse.next();
    res.cookies.set("view", "desktop", { path: "/", maxAge: 60 * 60 * 24 * 30 });
    return res;
  }
  if (mobileOverride) {
    const mobilePath = toMobilePath(pathname);
    if (mobilePath !== pathname) {
      url.pathname = mobilePath;
      const res = NextResponse.redirect(url);
      res.cookies.set("view", "mobile", { path: "/", maxAge: 60 * 60 * 24 * 30 });
      return res;
    }
    const res = NextResponse.next();
    res.cookies.set("view", "mobile", { path: "/", maxAge: 60 * 60 * 24 * 30 });
    return res;
  }

  // If the user previously chose a view, honor it
  const viewCookie = req.cookies.get("view")?.value;
  if (viewCookie === "desktop") return NextResponse.next();
  if (viewCookie === "mobile") {
    const mobilePath = toMobilePath(pathname);
    if (mobilePath !== pathname) {
      url.pathname = mobilePath;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // Prefer Client Hints when available
  // - sec-ch-ua-mobile: "?1" for mobile, "?0" for not
  // - sec-ch-ua-platform can help distinguish iPad/Mac but requires opt-in
  const chMobile = req.headers.get("sec-ch-ua-mobile"); // "?1" | "?0" | null
  if (chMobile === "?1") {
    // It’s a phone (per CH). Route to /m unless already there.
    if (!pathname.startsWith("/m")) {
      url.pathname = toMobilePath(pathname);
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  } else if (chMobile === "?0") {
    // Not a phone per CH → treat as desktop
    return NextResponse.next();
  }

  // Fallback to UA sniffing if CH not present
  const ua = req.headers.get("user-agent") || "";
  const isMobile = MOBILE_RE.test(ua) && !TABLET_RE.test(ua);

  if (isMobile && !pathname.startsWith("/m")) {
    url.pathname = toMobilePath(pathname);
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

// Apply to everything except Next internals
export const config = {
  matcher: ["/((?!_next|favicon|robots\\.txt|sitemap\\.xml).*)"],
};
