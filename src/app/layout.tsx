import "./globals.css";
import Providers from "./providers";

export const metadata = {
  title: "Nickel City X-Wing",
  description: "Track matchups, standings, and stats for the NCX League.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* PWA meta & manifest */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#ff00ff" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>

      <body className="bg-zinc-950 text-zinc-100">
        <Providers>
          <main className="min-h-screen">{children}</main>
        </Providers>

        {/* 👇 Register the service worker globally (runs on every page) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                if ('serviceWorker' in navigator) {
                  // Register at root scope so it controls the whole site
                  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function(){});
                }
              })();
            `,
          }}
        />

        {/* 👇 Your viewport width tracking script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function setVW() {
                  try {
                    var vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
                    document.cookie = "vw=" + vw + "; path=/; samesite=lax";
                  } catch (e) {}
                }
                setVW();
                var tid;
                window.addEventListener('resize', function() {
                  clearTimeout(tid);
                  tid = setTimeout(setVW, 200);
                }, { passive: true });
              })();
            `,
          }}
        />
        <script
  dangerouslySetInnerHTML={{
    __html: `
      (function () {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function(){});
        }
      })();
    `,
  }}
/>

      </body>
    </html>
  );
}

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};
