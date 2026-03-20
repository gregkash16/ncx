/**
 * iOS Session Check Endpoint
 *
 * Reads the custom iOS session cookie and returns user data
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const iosSessionCookie = req.cookies.get('ios-session')?.value;

    if (!iosSessionCookie) {
      return NextResponse.json(
        { user: null },
        { status: 200 }
      );
    }

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
  } catch (err: any) {
    console.error('iOS session check error:', err);
    return NextResponse.json(
      { user: null },
      { status: 200 }
    );
  }
}
