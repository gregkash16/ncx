/**
 * iOS Session Verification Endpoint
 *
 * Called by the iOS app after receiving Discord user data via deep link.
 * Creates a custom session cookie with user data.
 *
 * This solves two problems:
 * 1. Safari and WebView have separate cookie storage (so we can't set cookie in Safari)
 * 2. NextAuth's JWT verification is complex; we create a simple custom cookie instead
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, userName } = body;

    // Validate input
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Missing userId' },
        { status: 400 }
      );
    }

    // Create response
    const response = NextResponse.json(
      { success: true, message: 'Session created' },
      { status: 200 }
    );

    // Store user data in a simple JSON cookie
    const userData = {
      userId,
      userName: userName || 'User',
      createdAt: new Date().toISOString(),
    };

    const isProd = process.env.NODE_ENV === 'production';
    const cookieDomain = isProd ? '.nickelcityxwing.com' : undefined;

    // Set iOS session cookie (simple JSON, no JWT complexity)
    response.cookies.set('ios-session', JSON.stringify(userData), {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      ...(isProd && { domain: cookieDomain }),
      path: '/',
    });

    return response;
  } catch (err: any) {
    console.error('iOS verify error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Session creation failed' },
      { status: 500 }
    );
  }
}
