"use client";

import { usePathname } from "next/navigation";
import LoginControl from "./LoginControl";

export default function ShowDesktopLoginOnly() {
  const pathname = usePathname();
  // Hide on all mobile pages (/m and any subroutes)
  if (pathname.startsWith("/m")) return null;

  // Also hide on small screens (mobile) even on desktop routes, if you want
  // Remove this className if you DO want it on small screens outside /m
  return <LoginControl className="hidden md:inline-flex" />;
}
