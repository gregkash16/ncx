"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import MobileNavDrawer from "./MobileNavDrawer";

export default function MobileNavButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        aria-label="Open navigation"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--ncx-border)] bg-[rgb(0_0_0/0.28)] hover:bg-[rgb(0_0_0/0.40)] active:scale-95 text-[var(--ncx-text-primary)]"
      >
        <Menu className="h-5 w-5" />
      </button>

      <MobileNavDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
