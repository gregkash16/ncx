/**
 * Capacitor utilities for native iOS app
 */

import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';

/**
 * Check if running in Capacitor native app
 */
export const isCapacitor = () => Capacitor.isNativePlatform();

/**
 * Check if running in iOS specifically
 */
export const isIOS = () => Capacitor.getPlatform() === 'ios';

/**
 * Open a URL in Safari (for Discord OAuth and other external links)
 */
export const openInSafari = async (url: string) => {
  if (isCapacitor()) {
    await Browser.open({ url });
  } else {
    window.open(url, '_blank');
  }
};

/**
 * Setup deeplink handler for OAuth callbacks
 * Call this on app initialization to handle Discord auth redirects
 *
 * Example usage:
 * setupDeeplinkHandler((deeplink) => {
 *   if (deeplink.includes('auth-callback')) {
 *     // Handle auth callback
 *     const params = new URLSearchParams(deeplink.split('?')[1]);
 *     const success = params.get('success');
 *     const error = params.get('error');
 *     // ... handle success/error
 *   }
 * });
 */
export const setupDeeplinkHandler = (onDeeplink: (url: string) => void) => {
  if (!isCapacitor()) return;

  // Handle app launch with deeplink
  App.getDeepLinkData().then((data) => {
    if (data.url) {
      onDeeplink(data.url);
    }
  });

  // Handle deeplinks while app is already open
  App.addListener('appUrlOpen', (event: any) => {
    const url = event.url;
    if (url) {
      onDeeplink(url);
    }
  });
};

/**
 * Initiate Discord login with Safari
 * Opens Discord OAuth in Safari and handles the callback via deep link
 */
export const startDiscordLogin = async (clientId: string): Promise<{ success: boolean; error?: string }> => {
  if (!isCapacitor()) {
    // In browser, use normal OAuth flow (NextAuth handles it)
    return { success: true };
  }

  const baseUrl = getApiBaseUrl() || 'http://localhost:3000';
  const redirectUri = `${baseUrl}/api/auth/ios-callback`;
  const state = Math.random().toString(36).substring(7);

  const discordAuthUrl = new URL('https://discord.com/api/oauth2/authorize');
  discordAuthUrl.searchParams.set('client_id', clientId);
  discordAuthUrl.searchParams.set('redirect_uri', redirectUri);
  discordAuthUrl.searchParams.set('response_type', 'code');
  discordAuthUrl.searchParams.set('scope', 'identify');
  discordAuthUrl.searchParams.set('state', state);

  try {
    // Open Discord auth in Safari
    await openInSafari(discordAuthUrl.toString());

    // Return and let the deeplink handler manage the callback
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to open Discord login',
    };
  }
};

/**
 * Get base URL for API calls in Capacitor
 * In native app, we can call localhost:3000 directly
 */
export const getApiBaseUrl = () => {
  if (isCapacitor() && typeof window !== 'undefined') {
    return 'http://localhost:3000'; // or your production domain
  }
  return '';
};
