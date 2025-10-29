import { NextResponse } from "next/server";
import { fetchVideosByNCXID } from "@/lib/youtube";
import { PLAYLIST_IDS } from "@/app/components/PlayersPanelServer";

// Optional: cache at the route level (ISR-like)
export const revalidate = 600; // seconds

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ncxid = (searchParams.get("ncxid") || "").trim();
    if (!ncxid) {
      return NextResponse.json({ error: "Missing ncxid" }, { status: 400 });
    }
    if (!PLAYLIST_IDS.length) {
      return NextResponse.json({ videos: [] });
    }

    const rawVideos = await fetchVideosByNCXID(ncxid, PLAYLIST_IDS);

    const videos = (rawVideos ?? []).map((v) => ({
      id: v.id,
      title: v.title,
      tags: v.tags ?? [],
      thumb: `https://img.youtube.com/vi/${v.id}/mqdefault.jpg`,
      embedUrl: `https://www.youtube.com/embed/${v.id}`,
    }));

    // Add simple caching headers for clients/CDN
    const res = NextResponse.json({ videos });
    res.headers.set("Cache-Control", "public, max-age=60, s-maxage=600, stale-while-revalidate=600");
    return res;
  } catch (err) {
    console.error("[GET /api/player-videos] error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
