// src/middleware.ts
import { NextResponse, userAgent, type NextRequest } from "next/server";

export const config = {
  // Keep your existing matcher (it already excludes /api),
  // but the middleware below ALSO early-returns on /api as a backstop.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|site.webmanifest|manifest.webmanifest|apple-touch-icon.png|logos|factions|images|assets|fonts|.*\\.[0-9a-zA-Z]+$).*)",
  ],
};

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ---------------------------------------------------------------------------
  // HARD EXCLUSIONS (belt & suspenders)
  // If ANY of these match, we never redirect.
  // This prevents subtle breakage of multipart uploads and image rendering.
  // ---------------------------------------------------------------------------

  // All API routes must never be redirected (uploads, image generation, etc.)
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Next internals
  if (pathname.startsWith("/_next")) {
    return NextResponse.next();
  }

  // Common public files
  if (
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/site.webmanifest" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/apple-touch-icon.png"
  ) {
    return NextResponse.next();
  }

  // Public asset folders
  if (
    pathname.startsWith("/logos") ||
    pathname.startsWith("/factions") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/assets") ||
    pathname.startsWith("/fonts")
  ) {
    return NextResponse.next();
  }

  // Any request that ends with a file extension (png/jpg/svg/js/css/woff2/map/etc.)
  if (/\.[0-9a-zA-Z]+$/.test(pathname)) {
    return NextResponse.next();
  }

  // ---------------------------------------------------------------------------
  // BOT EXCLUSION
  // ---------------------------------------------------------------------------
  const { device, isBot, ua } = userAgent(req);
  if (isBot) return NextResponse.next();

  // ---------------------------------------------------------------------------
  // MOBILE REDIRECT LOGIC
  // ---------------------------------------------------------------------------
  const onMobilePath = pathname.startsWith("/m");

  // Robust mobile check (device.type is best, ua fallback for odd UAs)
  const deviceSaysMobile = device?.type === "mobile" || device?.type === "tablet";
  const uaSaysMobile = /iphone|android|ipad|ipod|mobile/i.test(ua || "");
  const isMobile = deviceSaysMobile || uaSaysMobile;

  if (isMobile && !onMobilePath) {
    return NextResponse.redirect(new URL("/m", req.nextUrl));
  }

  if (!isMobile && onMobilePath) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
}
