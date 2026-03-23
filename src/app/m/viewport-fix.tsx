'use client';

import { useEffect } from 'react';

/**
 * iOS Safari PWA viewport and zoom fix
 * Resets zoom to 100% and locks viewport height to prevent white space
 */
export default function ViewportFix() {
  useEffect(() => {
    // Reset zoom to 100% - fixes white space that appears/disappears with zoom
    const resetZoom = () => {
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=yes');
      }
    };

    const setViewportHeight = () => {
      // Lock the viewport height to the actual window height at load time
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    // Reset zoom and set viewport height on mount
    resetZoom();
    setViewportHeight();

    // Also try programmatic zoom reset for iOS
    if (navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')) {
      // Force scale reset by updating viewport
      setTimeout(() => {
        document.documentElement.style.zoom = '1';
      }, 100);
    }

    // Reset on resize (orientation change)
    window.addEventListener('resize', setViewportHeight);
    window.addEventListener('orientationchange', () => {
      resetZoom();
      setViewportHeight();
    });

    return () => {
      window.removeEventListener('resize', setViewportHeight);
      window.removeEventListener('orientationchange', setViewportHeight);
    };
  }, []);

  return null;
}
