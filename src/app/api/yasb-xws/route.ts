// src/app/api/yasb-xws/route.ts
import { NextRequest, NextResponse } from "next/server";

function buildPatternAnalyzerUrl(yasbUrl: string): string | null {
  if (!yasbUrl.startsWith("https://yasb.app")) return null;
  const parts = yasbUrl.split("yasb.app/");
  if (parts.length < 2) return null;
  const dataLink = parts[1]; // "?f=...&d=..."
  return `https://www.pattern-analyzer.app/api/yasb/xws${dataLink}`;
}

function buildLaunchBayUrl(lbxValue: string): string | null {
  if (!lbxValue) return null;
  // lbxValue is the raw piece after lbx= from the original URL
  return `https://launchbaynext.app/api/xws?lbx=${lbxValue}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const yasb = searchParams.get("yasb");
  const lbx = searchParams.get("lbx");

  let upstreamUrl: string | null = null;

  if (yasb) {
    if (!yasb.startsWith("https://yasb.app")) {
      return NextResponse.json(
        { error: "Invalid yasb URL" },
        { status: 400 }
      );
    }
    upstreamUrl = buildPatternAnalyzerUrl(yasb);
  } else if (lbx) {
    upstreamUrl = buildLaunchBayUrl(lbx);
  } else {
    return NextResponse.json(
      { error: "Missing yasb or lbx parameter" },
      { status: 400 }
    );
  }

  if (!upstreamUrl) {
    return NextResponse.json(
      { error: "Could not build upstream URL" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(upstreamUrl, {
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
    console.error("XWS proxy error:", err);
    return NextResponse.json(
      { error: "Failed to reach upstream" },
      { status: 502 }
    );
  }
}
