// app/layout.tsx
import "./globals.css";
import Providers from "./providers";
import Script from "next/script";
import { NCX_BRAND } from "@/theme/base";
import DesktopHeader from "./components/DesktopHeader";
import ShowDesktopLoginOnly from "./components/ShowDesktopLoginOnly";

export const metadata = {
  title: "Nickel City X-Wing",
  description: "Track matchups, standings, and stats for the NCX League.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content={NCX_BRAND.themeColor} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />

        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-1BC1MGNQSV"
          strategy="afterInteractive"
        />
        <Script id="ga-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-1BC1MGNQSV');
          `}
        </Script>
      </head>

      <body className="text-[var(--ncx-text-primary)]">
        <Providers>
          {/* Header must be ABOVE auth gates */}
          <DesktopHeader />

          {/* Auth gate can block content, not layout */}
          <ShowDesktopLoginOnly />

          {children}
        </Providers>
      </body>
    </html>
  );
}
