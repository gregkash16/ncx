import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// simple regex patterns
const MOBILE_RE = /iPhone|Android.+Mobile|Windows Phone|webOS|BlackBerry/i;
const TABLET_RE = /iPad|Android(?!.*Mobile)/i; // tablets treated as desktop

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  const url = req.nextUrl.clone();

  // Ignore Next internals and assets
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/public")
  ) {
    return NextResponse.next();
  }

  // Respect explicit overrides
  if (searchParams.get("desktop") === "1") return NextResponse.next();
  if (searchParams.get("mobile") === "1") {
    if (!pathname.startsWith("/m")) {
      url.pathname = "/m";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const ua = req.headers.get("user-agent") || "";

  // Route phones to /m, keep tablets/desktops on /
  if (MOBILE_RE.test(ua) && !TABLET_RE.test(ua)) {
    if (!pathname.startsWith("/m")) {
      url.pathname = "/m";
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

// Apply to everything except Next internals
export const config = {
  matcher: ["/((?!_next|favicon|robots\\.txt|sitemap\\.xml).*)"],
};
