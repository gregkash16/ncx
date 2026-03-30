'use client';
import { SessionProvider } from 'next-auth/react';
import { useEffect } from 'react';
import { initCapacitor } from '@/lib/capacitor';

export default function Providers({ children }: { children: React.ReactNode }) {
  // Initialize Capacitor on app startup (adds x-app-platform header for iOS)
  useEffect(() => {
    initCapacitor();
  }, []);

  return (
    <SessionProvider>
      {children}
    </SessionProvider>
  );
}
