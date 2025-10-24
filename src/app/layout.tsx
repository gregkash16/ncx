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
        {/* app/layout.tsx */}
<html lang="en">
  <body>
    {children}
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
})();`,
      }}
    />
  </body>
</html>

      </body>
    </html>
  );
}
