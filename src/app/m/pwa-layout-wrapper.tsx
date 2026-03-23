'use client';

import { useEffect, useState, ReactNode } from 'react';
import { isCapacitor } from '@/lib/capacitor';

export default function PWALayoutWrapper({ children }: { children: ReactNode }) {
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    // Detect if NOT running in Capacitor (i.e., PWA mode)
    setIsPWA(!isCapacitor());
  }, []);

  return (
    <>
      {isPWA && (
        <style>{`
          /* PWA-specific fixes - only applies in web browser */
          [data-pwa-layout] {
            display: flex;
            flex-direction: column;
            height: 100dvh;
            overflow: hidden;
          }

          [data-pwa-layout] main {
            overflow-y: auto;
            overflow-x: hidden;
          }

          /* Fix nav positioning on PWA */
          [data-pwa-layout] nav[aria-label="Mobile tabs"] {
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            height: 64px !important;
            z-index: 30 !important;
          }
        `}</style>
      )}
      <div data-pwa-layout={isPWA ? 'true' : undefined}>
        {children}
      </div>
    </>
  );
}
