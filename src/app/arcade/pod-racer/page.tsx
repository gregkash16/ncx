// src/app/arcade/pod-racer/page.tsx
"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PodRacerPage() {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", display: "flex", flexDirection: "column" }}>
      <Link
        href="/?tab=arcade"
        style={{
          position: "absolute", top: 10, left: 10, zIndex: 10,
          display: "flex", alignItems: "center", gap: 5,
          color: "#aaa", fontSize: 12, fontFamily: "monospace",
          background: "rgba(0,0,0,0.7)", padding: "5px 10px",
          borderRadius: 6, border: "1px solid #444", textDecoration: "none",
        }}
      >
        <ArrowLeft size={13} /> BACK TO ARCADE
      </Link>
      <iframe
        src="/pod-racer/index.html"
        style={{ flex: 1, border: "none", width: "100%", height: "100%" }}
        title="Pod Racer"
        allowFullScreen
      />
    </div>
  );
}
