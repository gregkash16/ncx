'use client';

import { ReactNode } from 'react';

export default function PWALayoutWrapper({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        /* PWA-specific fixes */
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
          bottom: 0;
          left: 0;
          right: 0;
          height: 64px;
          width: 100%;
          z-index: 30;
          /* iOS PWA fix - ensure it's actually at viewport bottom */
          margin-bottom: 0;
          padding-bottom: env(safe-area-inset-bottom, 0px);
          box-sizing: border-box;
        }
      `}</style>
      <div data-pwa-layout="true">
        {children}
      </div>
    </>
  );
}
