// src/app/api/yasb-xws/route.ts
import { NextRequest, NextResponse } from "next/server";

function buildPatternAnalyzerUrl(yasbUrl: string): string | null {
  if (!yasbUrl.startsWith("https://yasb.app")) return null;
  const parts = yasbUrl.split("yasb.app/");
  if (parts.length < 2) return null;
  const dataLink = parts[1]; // "?f=...&d=..."
  return `https://www.pattern-analyzer.app/api/yasb/xws${dataLink}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const yasb = searchParams.get("yasb");

  if (!yasb || !yasb.startsWith("https://yasb.app")) {
    return NextResponse.json(
      { error: "Missing or invalid yasb URL" },
      { status: 400 }
    );
  }

  const apiUrl = buildPatternAnalyzerUrl(yasb);
  if (!apiUrl) {
    return NextResponse.json(
      { error: "Could not build upstream URL" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(apiUrl, {
      // Don't cache lists aggressively; you can tweak this
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Upstream error", status: res.status },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("YASB proxy error:", err);
    return NextResponse.json(
      { error: "Failed to reach upstream" },
      { status: 502 }
    );
  }
}
