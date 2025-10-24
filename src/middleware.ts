// src/middleware.ts
import { NextResponse, userAgent, type NextRequest } from 'next/server';

export const config = {
  matcher: [
    '/',
    '/((?!m|api|_next|static|favicon.ico|robots.txt|sitemap.xml|images|assets).*)',
  ],
};

export function middleware(req: NextRequest) {
  const { device, isBot, ua } = userAgent(req);
  if (isBot) return NextResponse.next();

  const url = req.nextUrl;
  const onMobilePath = url.pathname.startsWith('/m');

  // Robust mobile check (device.type is best, ua fallback for odd UAs)
  const deviceSaysMobile = device?.type === 'mobile' || device?.type === 'tablet';
  const uaSaysMobile = /iphone|android|ipad|ipod|mobile/i.test(ua || '');
  const isMobile = deviceSaysMobile || uaSaysMobile;

  if (isMobile && !onMobilePath) return NextResponse.redirect(new URL('/m', url));
  if (!isMobile && onMobilePath) return NextResponse.redirect(new URL('/', url));

  return NextResponse.next();
}
