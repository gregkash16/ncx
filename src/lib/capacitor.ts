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
 */
export const setupDeeplinkHandler = (onDeeplink: (url: string) => void) => {
  if (!isCapacitor()) return;

  App.addListener('appUrlOpen', (event: any) => {
    const slug = event.url.split('.app').pop();
    if (slug) {
      onDeeplink(slug);
    }
  });
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
