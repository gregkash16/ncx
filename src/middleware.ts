// src/middleware.ts
import { NextResponse, userAgent, type NextRequest } from 'next/server';

export const config = {
  // Exclude:
  //  - Next internals (_next/*)
  //  - APIs (optional)
  //  - Public asset folders (logos, factions, images, assets, fonts)
  //  - Common public files (favicons, sitemap, manifests)
  //  - ANY request that ends with a file extension (png/jpg/svg/js/css/woff2/map/etc.)
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|site.webmanifest|manifest.webmanifest|apple-touch-icon.png|logos|factions|images|assets|fonts|.*\\.[0-9a-zA-Z]+$).*)',
  ],
};

export function middleware(req: NextRequest) {
  const { device, isBot, ua } = userAgent(req);
  if (isBot) return NextResponse.next();

  const { pathname } = req.nextUrl;

  // Belt & suspenders: if a request clearly targets a file, skip middleware.
  // (Catches edge cases if the matcher changes.)
  if (/\.[0-9a-zA-Z]+$/.test(pathname)) {
    return NextResponse.next();
  }

  const onMobilePath = pathname.startsWith('/m');

  // Robust mobile check (device.type is best, ua fallback for odd UAs)
  const deviceSaysMobile = device?.type === 'mobile' || device?.type === 'tablet';
  const uaSaysMobile = /iphone|android|ipad|ipod|mobile/i.test(ua || '');
  const isMobile = deviceSaysMobile || uaSaysMobile;

  if (isMobile && !onMobilePath) return NextResponse.redirect(new URL('/m', req.nextUrl));
  if (!isMobile && onMobilePath) return NextResponse.redirect(new URL('/', req.nextUrl));

  return NextResponse.next();
}
