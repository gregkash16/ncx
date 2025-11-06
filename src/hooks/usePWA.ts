// src/hooks/usePWA.ts
'use client';

import { useEffect, useState } from 'react';

export function usePWAInfo() {
  const [isStandalone, setStandalone] = useState(false);   // installed PWA?
  const [isIOS, setIsIOS] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);

  useEffect(() => {
    const nav: any = navigator;

    // Detect installed PWA (cross-platform)
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      nav.standalone === true; // iOS Safari
    setStandalone(Boolean(standalone));

    // iOS detection (rough but fine for gating)
    const ua = (globalThis.navigator?.userAgent || '').toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    // Baseline push support check
    setPushSupported('serviceWorker' in navigator && 'PushManager' in window);
  }, []);

  // Final capability: iOS must be installed PWA; others just need baseline support
  const canUseWebPush = pushSupported && (!isIOS || (isIOS && isStandalone));

  return { isStandalone, isIOS, pushSupported, canUseWebPush };
}
