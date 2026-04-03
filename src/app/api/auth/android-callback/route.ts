/**
 * Android OAuth callback handler
 *
 * Discord redirects here after user authenticates.
 * Exchanges code for token, fetches user info, then redirects
 * to the Android app via ncx:// deep link scheme.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    const errorDesc = searchParams.get('error_description') || error;
    return NextResponse.redirect(
      `ncx://auth?error=${encodeURIComponent(errorDesc)}`
    );
  }

  if (!code) {
    return NextResponse.redirect('ncx://auth?error=Missing+code');
  }

  try {
    const isProd = process.env.NODE_ENV === 'production';
    const redirectUri = isProd
      ? 'https://nickelcityxwing.com/api/auth/android-callback'
      : 'https://6e211c86e8ca.ngrok.app/api/auth/android-callback';

    // Use Android-specific Discord app credentials, or fall back to main ones
    const clientId = process.env.ANDROID_DISCORD_CLIENT_ID || process.env.DISCORD_CLIENT_ID || '';
    const clientSecret = process.env.ANDROID_DISCORD_CLIENT_SECRET || process.env.DISCORD_CLIENT_SECRET || '';

    // Exchange code for token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Discord token exchange failed: ${tokenResponse.statusText}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Get Discord user info
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userResponse.ok) {
      throw new Error('Failed to fetch Discord user');
    }

    const user = await userResponse.json();

    // Build avatar URL
    const avatarUrl = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
      : '';

    // Redirect to Android app via deep link
    const deepLink =
      `ncx://auth?success=true` +
      `&userId=${user.id}` +
      `&userName=${encodeURIComponent(user.global_name || user.username)}` +
      `&avatar=${encodeURIComponent(avatarUrl)}`;

    return NextResponse.redirect(deepLink);
  } catch (err: any) {
    console.error('Android auth callback error:', err);
    return NextResponse.redirect(
      `ncx://auth?error=${encodeURIComponent(err.message || 'Authentication failed')}`
    );
  }
}
