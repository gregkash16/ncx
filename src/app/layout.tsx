'use client';
import { useState } from 'react';
import Link from 'next/link';
import './globals.css';
import LoginControl from "./components/LoginControl";
import { SessionProvider } from "next-auth/react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
const [open, setOpen] = useState(false);


return (
<html lang="en">
<body className="bg-zinc-950 text-zinc-100">
 
  <SessionProvider>
  <LoginControl />
{/* Hamburger Button */}
<button
onClick={() => setOpen(!open)}
className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-zinc-900 border border-zinc-700 hover:bg-zinc-800"
>
<div className="w-6 h-0.5 bg-white mb-1"></div>
<div className="w-6 h-0.5 bg-white mb-1"></div>
<div className="w-6 h-0.5 bg-white"></div>
</button>


{/* Sidebar */}
<aside
className={`fixed top-0 left-0 h-full w-64 bg-zinc-900 shadow-lg transform transition-transform duration-300 z-40 ${
open ? 'translate-x-0' : '-translate-x-full'
}`}
>
<nav className="flex flex-col mt-20 space-y-6 p-6 text-lg">
<Link href="/" onClick={() => setOpen(false)} className="hover:text-white/80">🏠 Home</Link>
<Link href="/standings" onClick={() => setOpen(false)} className="hover:text-white/80">📊 Standings</Link>
<Link href="/matchups" onClick={() => setOpen(false)} className="hover:text-white/80">⚔️ Matchups</Link>
<Link href="/statistics" onClick={() => setOpen(false)} className="hover:text-white/80">📈 Statistics</Link>
<Link href="/advanced-statistics" onClick={() => setOpen(false)} className="hover:text-white/80">🧠 Adv. Statistics</Link>
<Link href="/report" onClick={() => setOpen(false)} className="hover:text-white/80">📝 Report</Link>
</nav>
</aside>


{/* Overlay when sidebar is open */}
{open && (
<div
onClick={() => setOpen(false)}
className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30"
></div>
)}


{/* Main Content */}
<main>

{children}
</main>
    </SessionProvider>
</body>
</html>
);
}