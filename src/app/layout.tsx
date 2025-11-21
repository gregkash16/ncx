// app/layout.tsx
import "./globals.css";
import Providers from "./providers";
import Script from "next/script";

export const metadata = {
  title: "Nickel City X-Wing",
  description: "Track matchups, standings, and stats for the NCX League.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#ff00ff" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />

        {/* Google Analytics – loads globally */}
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

      <body className="bg-zinc-950 text-zinc-100">
        <Providers>
          {children}
        </Providers>

        {/* Global scripts stay here */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js').catch(()=>{});
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
