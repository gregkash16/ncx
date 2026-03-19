/**
 * iOS session confirmation endpoint
 *
 * Called after NextAuth creates the session.
 * Redirects back to the app via deep link with a success signal.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    // Get the newly created session from NextAuth
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.redirect(
        'com.ncx.app://auth?error=No+session+created'
      );
    }

    const user = session.user;
    const userData = encodeURIComponent(
      JSON.stringify({
        id: (user as any).discordId || (user as any).id,
        name: user.name,
        avatar: user.image,
      })
    );

    // Redirect back to the app with session data
    return NextResponse.redirect(`com.ncx.app://auth?user=${userData}&success=true`);
  } catch (err: any) {
    console.error('iOS session error:', err);
    return NextResponse.redirect(
      `com.ncx.app://auth?error=${encodeURIComponent(err.message || 'Session error')}`
    );
  }
}
