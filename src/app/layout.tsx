// app/layout.tsx
import "./globals.css";
import Providers from "./providers";
import Script from "next/script";
import { NCX_BRAND } from "@/theme/base";

export const metadata = {
  title: "Nickel City X-Wing",
  description: "Track matchups, standings, and stats for the NCX League.",
  viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content={NCX_BRAND.themeColor} />

        {/* Google Analytics */}
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
