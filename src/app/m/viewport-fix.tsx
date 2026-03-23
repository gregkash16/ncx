'use client';

import { useEffect } from 'react';

/**
 * iOS Safari PWA viewport height fix
 * Locks viewport height at page load to prevent white space from dynamic viewport changes
 * @see https://dev.to/swhabitation/how-to-fix-the-annoying-white-space-issue-in-ios-safari-a-beginners-guide-with-easy-solutions-475l
 */
export default function ViewportFix() {
  useEffect(() => {
    const setViewportHeight = () => {
      // Lock the viewport height to the actual window height at load time
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    // Set on mount
    setViewportHeight();

    // Reset on resize (orientation change)
    window.addEventListener('resize', setViewportHeight);
    window.addEventListener('orientationchange', setViewportHeight);

    return () => {
      window.removeEventListener('resize', setViewportHeight);
      window.removeEventListener('orientationchange', setViewportHeight);
    };
  }, []);

  return null;
}
