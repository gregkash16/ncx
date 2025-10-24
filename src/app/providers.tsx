'use client';
import { SessionProvider } from 'next-auth/react';
import ShowDesktopLoginOnly from './components/ShowDesktopLoginOnly';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ShowDesktopLoginOnly />
      {children}
    </SessionProvider>
  );
}
