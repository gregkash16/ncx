import { google } from "googleapis";
// import type { youtube_v3 } from "googleapis"; // <- not needed here; safe to remove
import { PLAYLIST_IDS } from "@/app/components/PlayersPanelServer";

const yt = google.youtube({
  version: "v3",
  auth: process.env.YOUTUBE_API_KEY,
});

export type VideoLite = { id: string; title: string; tags: string[] };

const normTag = (t: string) => t.toLowerCase().replace(/\s+/g, "");
// ✅ match tag normalization (remove spaces too)
const keyForNCX = (ncxid: string) => `ncxid:${ncxid.toLowerCase().replace(/\s+/g, "")}`;

async function listAllVideoIds(playlistId: string): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const res = await yt.playlistItems.list({
      part: ["contentDetails"],
      playlistId,
      maxResults: 50,
      pageToken,
    });
    for (const it of res.data.items ?? []) {
      const vid = it.contentDetails?.videoId;
      if (vid) ids.push(vid);
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return ids;
}

/** Build { "ncxid:ncx123": VideoLite[] } across all playlists */
export async function buildNCXIndex(): Promise<Record<string, VideoLite[]>> {
  const index: Record<string, VideoLite[]> = {};
  // optional: track duplicates per key
  const seenPerKey: Record<string, Set<string>> = {};
  const allIds: string[] = [];

  for (const pid of PLAYLIST_IDS) {
    const ids = await listAllVideoIds(pid);
    allIds.push(...ids);
  }

  for (let i = 0; i < allIds.length; i += 50) {
    const batch = allIds.slice(i, i + 50);
    const res = await yt.videos.list({ part: ["snippet"], id: batch, maxResults: 50 });

    for (const v of res.data.items ?? []) {
      const id = v.id!;
      const title = v.snippet?.title ?? "";
      const tags = (v.snippet?.tags ?? []).filter(Boolean) as string[];
      if (!tags.length) continue;

      for (const t of tags) {
        const n = normTag(t); // handles "ncxid:NCX123" or "ncxid: NCX123"
        if (!n.startsWith("ncxid:ncx")) continue;

        // de-dupe the same video across multiple playlists
        if (!seenPerKey[n]) seenPerKey[n] = new Set<string>();
        if (seenPerKey[n].has(id)) continue;
        seenPerKey[n].add(id);

        if (!index[n]) index[n] = [];
        index[n].push({ id, title, tags });
      }
    }
  }

  return index;
}

export function lookupFromIndex(index: Record<string, VideoLite[]>, ncxid: string) {
  return index[keyForNCX(ncxid)] ?? [];
}
