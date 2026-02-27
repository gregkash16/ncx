import { NextResponse } from "next/server";

export const runtime = "nodejs";

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      // CDN cache for 1 hour; still allow manual bypass with ?nocache=1
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300",
      ...(init?.headers ?? {}),
    },
  });
}

function toAtlanticOnly(payload: any) {
  // NHL standings payloads commonly have: { standings: [...] }
  const rows: any[] = Array.isArray(payload?.standings) ? payload.standings : [];

  const atlantic = rows.filter((r) => {
    const div =
      (typeof r?.divisionName === "string" && r.divisionName) ||
      (typeof r?.divisionName?.default === "string" && r.divisionName.default) ||
      "";

    const divAbbrev = typeof r?.divisionAbbrev === "string" ? r.divisionAbbrev : "";

    // Be flexible: match by name or abbreviation if present
    return div.toLowerCase().includes("atlantic") || divAbbrev.toUpperCase() === "A";
  });

  // Sort by division rank if present, else by points desc
  atlantic.sort((a, b) => {
    const ra = typeof a?.divisionSequence === "number" ? a.divisionSequence : null;
    const rb = typeof b?.divisionSequence === "number" ? b.divisionSequence : null;
    if (ra != null && rb != null) return ra - rb;

    const pa = typeof a?.points === "number" ? a.points : 0;
    const pb = typeof b?.points === "number" ? b.points : 0;
    return pb - pa;
  });

  return atlantic;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const noCache = searchParams.get("nocache") === "1";

  // This is the common NHL web API standings endpoint.
  // If you ever see a 404, tell me and I’ll adjust to the exact shape your feed returns.
  const upstream = "https://api-web.nhle.com/v1/standings/now";

  try {
    const res = await fetch(upstream, {
      // If nocache=1, force a fresh fetch (and also bypass Next cache)
      cache: noCache ? "no-store" : "force-cache",
      // Revalidate hourly when cached
      next: noCache ? undefined : { revalidate: 3600 },
      headers: {
        "User-Agent": "ncx-secret-nhl-standings",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, upstream, status: res.status, statusText: res.statusText },
        { status: 502 }
      );
    }

    const data = await res.json();
    const atlantic = toAtlanticOnly(data);

    return json({
      ok: true,
      upstream,
      updatedAt: new Date().toISOString(),
      division: "Atlantic",
      data: atlantic,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, upstream, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}