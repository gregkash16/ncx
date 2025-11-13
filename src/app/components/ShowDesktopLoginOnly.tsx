"use client";

import { usePathname } from "next/navigation";
import LoginControl from "./LoginControl";

export default function ShowDesktopLoginOnly() {
  const pathname = usePathname();
  if (pathname.startsWith("/m")) return null;

  // apply responsive visibility to the wrapper instead of LoginControl
  return (
    <div className="hidden md:inline-flex">
      <LoginControl />
    </div>
  );
}
