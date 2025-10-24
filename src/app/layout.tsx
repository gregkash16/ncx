import './globals.css';
import Providers from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-100">
        <Providers>
          <main className="min-h-screen">{children}</main>
        </Providers>
        <script dangerouslySetInnerHTML={{ __html: `/* same cookie script */` }} />
      </body>
    </html>
  );
}
