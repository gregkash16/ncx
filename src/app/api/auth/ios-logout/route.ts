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

  // Clear the iOS session cookie
  response.cookies.set('ios-session', '', {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 0, // Delete cookie
    path: '/',
  });

  return response;
}
