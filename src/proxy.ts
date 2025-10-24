// src/proxy.ts
import { NextResponse, userAgent, type NextRequest } from 'next/server';

export const config = {
  matcher: [
    '/', // home
    '/((?!m|api|_next|static|favicon.ico|robots.txt|sitemap.xml).*)', // everything except mobile + assets
  ],
};

export default function proxy(req: NextRequest) {
  const { device, isBot } = userAgent(req);
  if (isBot) return NextResponse.next(); // don't redirect bots/crawlers

  const url = req.nextUrl;
  const isMobile = device?.type === 'mobile' || device?.type === 'tablet';
  const isOnMobilePath = url.pathname.startsWith('/m');

  // Mobile → /m
  if (isMobile && !isOnMobilePath) {
    const dest = new URL('/m', url);
    return NextResponse.redirect(dest);
  }

  // Desktop → root (in case someone shares a /m link)
  if (!isMobile && isOnMobilePath) {
    const dest = new URL('/', url);
    return NextResponse.redirect(dest);
  }

  return NextResponse.next();
}
