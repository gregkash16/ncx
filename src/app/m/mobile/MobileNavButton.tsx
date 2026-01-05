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
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900/70 hover:bg-neutral-800 active:scale-95"
      >
        <Menu className="h-5 w-5" />
      </button>

      <MobileNavDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
