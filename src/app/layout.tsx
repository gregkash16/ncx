'use client';
import './globals.css';
import { SessionProvider } from "next-auth/react";
import ShowDesktopLoginOnly from "./components/ShowDesktopLoginOnly";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-100">
        <SessionProvider>
          {/* Fixed login control in the top-right */}
          <ShowDesktopLoginOnly />
          {/* Main content */}
          <main className="min-h-screen">{children}</main>
        </SessionProvider>
      </body>
    </html>
  );
}
