/**
 * iOS OAuth callback handler
 *
 * Discord redirects here after user authenticates.
 * Since Safari is a separate app, we can't use cookies.
 * Instead, we handle the OAuth flow and redirect back to the app with the session.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  // Handle errors from Discord
  if (error) {
    const errorDesc = searchParams.get('error_description') || error;
    return NextResponse.redirect(
      `ncxapp://auth?error=${encodeURIComponent(errorDesc)}`
    );
  }

  // Validate code
  if (!code) {
    return NextResponse.redirect('ncxapp://auth?error=Missing+code');
  }

  try {
    // Exchange code for token with Discord
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID || '',
        client_secret: process.env.DISCORD_CLIENT_SECRET || '',
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${req.headers.get('x-forwarded-proto') || 'http'}://${req.headers.get('host')}/api/auth/ios-callback`,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Discord token exchange failed: ${tokenResponse.statusText}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Get Discord user info
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      throw new Error('Failed to fetch Discord user');
    }

    const user = await userResponse.json();

    // Create a session by calling NextAuth's callback
    // For now, just redirect back to the app with user info
    // In production, you'd want to create a proper session here
    const userData = encodeURIComponent(JSON.stringify({
      id: user.id,
      name: user.global_name || user.username,
      avatar: user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
        : undefined,
    }));

    return NextResponse.redirect(`ncxapp://auth?user=${userData}&success=true`);
  } catch (err: any) {
    console.error('iOS auth callback error:', err);
    return NextResponse.redirect(
      `ncxapp://auth?error=${encodeURIComponent(err.message || 'Authentication failed')}`
    );
  }
}
