import { NextResponse } from "next/server";
import { kvGet } from "@/lib/kv";
import type { VideoLite } from "@/lib/youtubeIndex";

export const revalidate = 0;

// Normalize exactly like the index builder
const normNCX = (ncxid: string) =>
  `ncxid:${ncxid.toLowerCase().replace(/\s+/g, "")}`;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = (searchParams.get("ncxid") || "").trim();
  if (!raw) {
    return NextResponse.json({ error: "Missing ncxid" }, { status: 400 });
  }

  const key = normNCX(raw);
  const index = await kvGet<Record<string, VideoLite[]>>("ncx:yt:index");

  const found = index?.[key] ?? [];
  const videos = found.map((v) => ({
    id: v.id,
    title: v.title,
    tags: v.tags,
    thumb: `https://img.youtube.com/vi/${v.id}/mqdefault.jpg`,
    embedUrl: `https://www.youtube.com/embed/${v.id}`,
  }));

  const res = NextResponse.json({ videos });
  res.headers.set(
    "Cache-Control",
    "public, max-age=60, s-maxage=60, stale-while-revalidate=300"
  );
  return res;
}
