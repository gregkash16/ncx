/**
 * Capacitor utilities for native iOS app
 */

import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';

/**
 * Initialize Capacitor on app startup
 * Adds x-app-platform header to all fetch requests in iOS app
 */
export const initCapacitor = () => {
  if (!isCapacitor()) return;

  // Wrap fetch to add x-app-platform header
  const originalFetch = window.fetch;
  window.fetch = function (resource, init = {}) {
    const url =
      typeof resource === 'string' ? resource : resource instanceof Request ? resource.url : String(resource);

    // Only add header for same-domain requests (don't add to external APIs)
    const isLocalRequest = typeof url === 'string' && (url.startsWith('/') || url.includes(window.location.hostname));

    if (isLocalRequest) {
      const headers = (init.headers as Record<string, string>) || {};
      headers['x-app-platform'] = 'ios';
      init.headers = headers;
    }

    return originalFetch.apply(this, [resource, init]);
  };
};

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
 * Clear the app badge count (notification indicator)
 */
export const clearBadgeCount = async () => {
  if (!isCapacitor() || !isIOS()) {
    return;
  }

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    await PushNotifications.removeAllDelivered();
    // Set badge count to 0 to clear the iOS app icon badge
    await PushNotifications.setLaunchDetails({ badge: 0 } as any).catch(() => {
      // Fallback if setLaunchDetails doesn't work
    });
    console.log('[APNS] Badge cleared');
  } catch (error) {
    console.error('[APNS] Failed to clear badge:', error);
  }
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

    // Set up listener for push notification open/tap
    PushNotifications.addListener('pushNotificationActionPerformed', (action: any) => {
      console.log('[APNS] Notification tapped:', action);
      // Clear badge when user taps notification
      clearBadgeCount();
    });

    // Set up listener for notification received while app is in foreground
    PushNotifications.addListener('pushNotificationReceived', (notification: any) => {
      console.log('[APNS] Notification received in foreground:', notification);
      // Clear badge when app is foregrounded with notification
      clearBadgeCount();
    });

    // CRITICAL: Set up listeners BEFORE calling register()
    // The registration event fires very fast natively and can be dropped if listeners aren't attached yet
    const token = await new Promise<string | null>((resolve) => {
      let resolved = false;

      PushNotifications.addListener('registration', (token: any) => {
        console.log('[APNS] Registration token received:', token.value);
        if (!resolved) {
          resolved = true;
          const deviceToken = token.value;
          if (typeof window !== 'undefined') {
            localStorage.setItem('ncx_apns_token', deviceToken);

            // Auto-save token to database with default "all teams" preference
            fetch('/api/push/apns-save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                deviceToken,
                prefs: { allTeams: true, teams: [] }
              })
            }).catch(e => console.error('[APNS] Failed to save token to database:', e));
          }
          resolve(deviceToken || null);
        }
      });

      PushNotifications.addListener('registrationError', (error: any) => {
        console.error('[APNS] Registration error:', error);
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
      });

      // Now call register — listeners are already attached
      PushNotifications.register().then(() => {
        console.log('[APNS] Register called');
      });

      // Timeout fallback for genuine failures (e.g. simulator, no entitlement)
      setTimeout(() => {
        if (!resolved) {
          console.warn('[APNS] Timeout - no token received (check entitlements/provisioning profile)');
          resolved = true;
          resolve(null);
        }
      }, 10000);
    });

    return token;
  } catch (error) {
    console.error('[APNS] Setup failed:', error);
    return null;
  }
};
