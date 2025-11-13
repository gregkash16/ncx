// src/app/components/ShowDesktopLoginOnly.tsx
"use client";

import { usePathname } from "next/navigation";
import LoginControl from "./LoginControl";

export default function ShowDesktopLoginOnly() {
  const pathname = usePathname();
  if (pathname.startsWith("/m")) return null;

  return (
    <div className="hidden md:inline-flex">
      <LoginControl />
    </div>
  );
}
