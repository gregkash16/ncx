// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const MOBILE_RE = /iPhone|Android.+Mobile|Windows Phone|webOS|BlackBerry/i;
const TABLET_RE = /iPad|Android(?!.*Mobile)/i; // treat tablets as desktop
const MOBILE_MAX_VW = 767; // Tailwind sm-1 breakpoint

function toMobilePath(pathname: string) {
  if (pathname === "/") return "/m";
  if (pathname.startsWith("/m")) return pathname;
  return `/m${pathname}`;
}
function fromMobilePath(pathname: string) {
  if (!pathname.startsWith("/m")) return pathname;
  // "/m" -> "/"; "/m/foo" -> "/foo"
  return pathname.length === 2 ? "/" : pathname.slice(2);
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

  // Query-string overrides (persist via cookie)
  const desktopOverride = searchParams.get("desktop") === "1";
  const mobileOverride = searchParams.get("mobile") === "1";
  if (desktopOverride || mobileOverride) {
    const res =
      desktopOverride
        ? NextResponse.next()
        : (() => {
            // push into /m immediately if not already there
            const mobilePath = toMobilePath(pathname);
            if (mobilePath !== pathname) {
              url.pathname = mobilePath;
              return NextResponse.redirect(url); // visible /m path
            }
            return NextResponse.next();
          })();

    res.cookies.set("view", desktopOverride ? "desktop" : "mobile", {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
    });
    return res;
  }

  // Honor prior choice
  const viewCookie = req.cookies.get("view")?.value;
  if (viewCookie === "desktop") return NextResponse.next();
  if (viewCookie === "mobile") {
    const mobilePath = toMobilePath(pathname);
    if (mobilePath !== pathname) {
      url.pathname = mobilePath;
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // 1) Prefer viewport width cookie if present (beats UA lies)
  const vwCookie = req.cookies.get("vw")?.value;
  const vw = vwCookie ? parseInt(vwCookie, 10) : NaN;
  if (!Number.isNaN(vw)) {
    const looksMobile = vw <= MOBILE_MAX_VW;
    if (looksMobile && !pathname.startsWith("/m")) {
      url.pathname = toMobilePath(pathname);
      return NextResponse.redirect(url);
    }
    if (!looksMobile && pathname.startsWith("/m")) {
      url.pathname = fromMobilePath(pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // 2) Fallback: Client Hints (rarely useful on Safari, but harmless)
  const chMobile = req.headers.get("sec-ch-ua-mobile"); // "?1"|"?0"|null
  if (chMobile === "?1" && !pathname.startsWith("/m")) {
    url.pathname = toMobilePath(pathname);
    return NextResponse.redirect(url);
  }
  if (chMobile === "?0") {
    return NextResponse.next();
  }

  // 3) Final fallback: UA regex
  const ua = req.headers.get("user-agent") || "";
  const isPhoneUA = MOBILE_RE.test(ua) && !TABLET_RE.test(ua);
  if (isPhoneUA && !pathname.startsWith("/m")) {
    url.pathname = toMobilePath(pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon|robots\\.txt|sitemap\\.xml).*)"],
};
