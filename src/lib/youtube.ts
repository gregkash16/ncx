import { google, youtube_v3 } from "googleapis";

const youtube = google.youtube({
  version: "v3",
  auth: process.env.YOUTUBE_API_KEY,
});

/**
 * Fetches videos across a list of playlist IDs that have a tag
 * like "ncxid: NCX123" or "ncxid:NCX123".
 */
export async function fetchVideosByNCXID(
  ncxid: string,
  playlists: string[]
): Promise<{ id: string; title: string; tags?: string[] }[]> {
  const results: { id: string; title: string; tags?: string[] }[] = [];

  for (const playlistId of playlists) {
    // ✅ fetch playlist items first
    const res = await youtube.playlistItems.list({
      part: ["snippet", "contentDetails"],
      playlistId,
      maxResults: 50,
    });

    // ✅ iterate playlist items
    for (const item of res.data.items ?? []) {
      const videoId = item.contentDetails?.videoId;
      if (!videoId) continue;

      // Fetch the video details (tags live here)
      const videoRes = await youtube.videos.list({
        part: ["snippet"],
        id: [videoId],
      });

      const video: youtube_v3.Schema$Video | undefined = videoRes.data.items?.[0];
      if (!video || !video.snippet) continue; // ✅ safety guard

      const tags = video.snippet.tags ?? [];
      const hasNCX = tags.some((t) => {
        const norm = t.toLowerCase().replace(/\s+/g, "");
        return norm === `ncxid:${ncxid.toLowerCase()}`;
      });

      if (hasNCX) {
        results.push({
          id: videoId,
          title: video.snippet.title ?? "",
          tags,
        });
      }
    }
  }

  return results;
}
