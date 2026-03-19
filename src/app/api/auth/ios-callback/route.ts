/**
 * iOS OAuth callback handler
 *
 * Discord redirects here after user authenticates.
 * Since Safari is a separate app without cookies, we handle the OAuth flow
 * and store the session info in the response.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  // Handle errors from Discord
  if (error) {
    const errorDesc = searchParams.get('error_description') || error;
    return NextResponse.redirect(
      `com.ncx.app://auth?error=${encodeURIComponent(errorDesc)}`
    );
  }

  // Validate code
  if (!code) {
    return NextResponse.redirect('com.ncx.app://auth?error=Missing+code');
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

    // Create response with session cookie
    const response = NextResponse.redirect(
      `com.ncx.app://auth?success=true&userId=${user.id}&userName=${encodeURIComponent(user.global_name || user.username)}`
    );

    // Set a session cookie so the app can use it
    response.cookies.set('discord-user-id', user.id, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (err: any) {
    console.error('iOS auth callback error:', err);
    return NextResponse.redirect(
      `com.ncx.app://auth?error=${encodeURIComponent(err.message || 'Authentication failed')}`
    );
  }
}
