/**
 * iOS Logout Endpoint
 *
 * Clears the custom iOS session cookie
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const response = NextResponse.json(
    { success: true, message: 'Logged out' },
    { status: 200 }
  );

  // Clear the iOS session cookie (must match the settings from ios-verify)
  const isProd = process.env.NODE_ENV === 'production';
  const cookieDomain = isProd ? '.nickelcityxwing.com' : undefined;

  response.cookies.set('ios-session', '', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 0, // Delete cookie
    ...(isProd && { domain: cookieDomain }),
    path: '/',
  });

  return response;
}
