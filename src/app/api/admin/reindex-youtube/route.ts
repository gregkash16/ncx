import { NextResponse } from "next/server";
import { buildNCXIndex } from "@/lib/youtubeIndex";
import { kvSet } from "@/lib/kv";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token || token !== process.env.REINDEX_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const index = await buildNCXIndex();
    await kvSet("ncx:yt:index", index);

    const keys = Object.keys(index);
    const sampleKey = keys[0] ?? null;
    const sampleCount = sampleKey ? index[sampleKey].length : 0;

    return NextResponse.json({
      ok: true,
      keys: keys.length,
      sampleKey,
      videosForSampleKey: sampleCount,
    });
  } catch (e: any) {
    console.error("reindex-youtube failed:", e);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
