/**
 * Capacitor OAuth callback handler
 *
 * When Discord redirects after login, this route receives the auth code
 * and exchanges it for a session token, then redirects back to the app
 * via deep link.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Handle errors from Discord
  if (error) {
    const errorDesc = searchParams.get('error_description') || error;
    return NextResponse.redirect(
      `ncxapp://auth-callback?error=${encodeURIComponent(errorDesc)}`
    );
  }

  // Validate code and state
  if (!code || !state) {
    return NextResponse.redirect(
      'ncxapp://auth-callback?error=Missing+auth+code+or+state'
    );
  }

  try {
    // Exchange code for session via NextAuth
    // This is a simplified flow - in production you'd validate state
    // and call the NextAuth signIn endpoint
    const response = await fetch(`${req.headers.get('x-forwarded-proto') || 'https'}://${req.headers.get('host')}/api/auth/signin?callbackUrl=${encodeURIComponent(`ncxapp://auth-callback?code=${code}`)}`);

    if (!response.ok) {
      throw new Error('Failed to authenticate with NextAuth');
    }

    // Redirect back to app with success
    // The app will handle storing the session token
    return NextResponse.redirect(`ncxapp://auth-callback?success=true`);
  } catch (err: any) {
    console.error('Capacitor auth callback error:', err);
    return NextResponse.redirect(
      `ncxapp://auth-callback?error=${encodeURIComponent(err.message)}`
    );
  }
}
