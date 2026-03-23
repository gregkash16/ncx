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
            width: 100%;
            position: relative;
          }

          [data-pwa-layout] main {
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            width: 100%;
          }

          /* Fix nav positioning on PWA - stick to bottom of viewport */
          [data-pwa-layout] nav[aria-label="Mobile tabs"] {
            position: fixed;
            bottom: env(safe-area-inset-bottom, 0px);
            left: 0;
            right: 0;
            height: 64px;
            width: 100%;
            z-index: 30;
          }
        `}</style>
      )}
      <div data-pwa-layout={isPWA ? 'true' : undefined}>
        {children}
      </div>
    </>
  );
}
