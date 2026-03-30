/**
 * iOS Session Check Endpoint
 *
 * Reads either:
 * - ios-session cookie (Discord OAuth)
 * - ios-apple-session cookie (Sign in with Apple)
 * And returns user data
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    // Check for Discord iOS session first
    const iosSessionCookie = req.cookies.get('ios-session')?.value;
    if (iosSessionCookie) {
      const userData = JSON.parse(iosSessionCookie);
      return NextResponse.json(
        {
          user: {
            id: userData.userId,
            discordId: userData.userId,
            name: userData.userName,
          },
        },
        { status: 200 }
      );
    }

    // Check for Apple Sign in session
    const appleSessionCookie = req.cookies.get('ios-apple-session')?.value;
    if (appleSessionCookie) {
      const appleData = JSON.parse(appleSessionCookie);
      return NextResponse.json(
        {
          user: {
            id: 'apple-' + appleData.email,
            name: appleData.name,
            email: appleData.email,
            isAppleAuth: true,
          },
        },
        { status: 200 }
      );
    }

    // No session found
    return NextResponse.json(
      { user: null },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('iOS session check error:', err);
    return NextResponse.json(
      { user: null },
      { status: 200 }
    );
  }
}
