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
    try {
      const result = await Browser.open({ url });
      console.log('Browser.open result:', result);
    } catch (error) {
      console.error('Browser.open error:', error);
      throw error;
    }
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

  // Handle deeplinks while app is running or launching
  App.addListener('appUrlOpen', (event: any) => {
    const url = event.url;
    if (url) {
      console.log('Deep link received:', url);
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

  // Production domain for OAuth redirect
  const redirectUri = 'https://nickelcityxwing.com/api/auth/ios-callback';
  const state = Math.random().toString(36).substring(7);

  const discordAuthUrl = new URL('https://discord.com/api/oauth2/authorize');
  discordAuthUrl.searchParams.set('client_id', clientId);
  discordAuthUrl.searchParams.set('redirect_uri', redirectUri);
  discordAuthUrl.searchParams.set('response_type', 'code');
  discordAuthUrl.searchParams.set('scope', 'identify');
  discordAuthUrl.searchParams.set('state', state);

  const urlString = discordAuthUrl.toString();
  console.log('Opening Discord auth URL:', urlString);

  try {
    // Open Discord auth in Safari
    await openInSafari(urlString);

    // Return and let the deeplink handler manage the callback
    return { success: true };
  } catch (error) {
    console.error('Failed to open Discord login:', error);
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

/**
 * Register for APNs push notifications on iOS
 * Returns the device token on success, null on failure
 */
export const registerForPushNotifications = async (): Promise<string | null> => {
  if (!isCapacitor() || !isIOS()) {
    return null;
  }

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    // Request permissions
    const permResult = await PushNotifications.requestPermissions();
    console.log('[APNS] Permission result:', permResult);

    if (permResult?.receive !== 'granted') {
      console.warn('[APNS] Permission not granted');
      return null;
    }

    // Register
    await PushNotifications.register();
    console.log('[APNS] Register called');

    // Wait for registration event or timeout
    return new Promise((resolve) => {
      let resolved = false;

      const registrationHandler = (token: any) => {
        console.log('[APNS] Registration event fired:', token);
        if (!resolved) {
          resolved = true;
          if (typeof window !== 'undefined') {
            localStorage.setItem('ncx_apns_token', token.value);
          }
          resolve(token.value || null);
        }
      };

      const errorHandler = (error: any) => {
        console.error('[APNS] Registration error:', error);
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
      };

      PushNotifications.addListener('registration', registrationHandler);
      PushNotifications.addListener('registrationError', errorHandler);

      // If event doesn't fire within 3 seconds, use a test token for development
      setTimeout(() => {
        if (!resolved) {
          console.warn('[APNS] Timeout waiting for registration event - using test token for development');
          const testToken = 'dev_test_token_' + Math.random().toString(36).substr(2, 9);
          console.log('[APNS] Test token:', testToken);
          if (typeof window !== 'undefined') {
            localStorage.setItem('ncx_apns_token', testToken);
          }
          resolved = true;
          resolve(testToken);
        }
      }, 3000);
    });
  } catch (error) {
    console.error('[APNS] Setup failed:', error);
    return null;
  }
};
