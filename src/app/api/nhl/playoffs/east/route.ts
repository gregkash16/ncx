import { NextResponse } from "next/server";

export const runtime = "nodejs";

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300",
      ...(init?.headers ?? {}),
    },
  });
}

function safeStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function teamAbbrev(row: any) {
  return safeStr(row?.teamAbbrev?.default) || safeStr(row?.teamAbbrev) || "";
}

function teamName(row: any) {
  return (
    safeStr(row?.teamName?.default) ||
    safeStr(row?.teamName) ||
    safeStr(row?.teamCommonName?.default) ||
    safeStr(row?.teamCommonName) ||
    ""
  );
}

// Different NHL payloads use different shapes for team id.
// We try a bunch.
function teamId(row: any): number | null {
  const candidates = [
    row?.teamId,
    row?.team?.id,
    row?.team?.teamId,
    row?.team?.teamID,
    row?.team?.default?.id,
  ];
  for (const c of candidates) {
    if (typeof c === "number") return c;
    if (typeof c === "string" && c.trim() && !Number.isNaN(Number(c))) return Number(c);
  }
  return null;
}

// Stable identifier for de-duping/excluding
function teamKey(row: any): string {
  const id = teamId(row);
  if (id != null) return `id:${id}`;

  const ab = teamAbbrev(row);
  if (ab) return `abbrev:${ab.toUpperCase()}`;

  const nm = teamName(row);
  if (nm) return `name:${nm.toLowerCase()}`;

  // worst-case fallback (keeps us from crashing)
  return `unknown:${JSON.stringify(row).slice(0, 60)}`;
}

function getDivisionName(row: any) {
  return (
    safeStr(row?.divisionName?.default) ||
    safeStr(row?.divisionName) ||
    safeStr(row?.divisionAbbrev) ||
    ""
  );
}

function isEastern(row: any) {
  const conf =
    safeStr(row?.conferenceName?.default) ||
    safeStr(row?.conferenceName) ||
    safeStr(row?.conferenceAbbrev) ||
    "";
  return conf.toLowerCase().includes("eastern") || conf.toUpperCase() === "E";
}

function isAtlantic(row: any) {
  const div = getDivisionName(row).toLowerCase();
  return div.includes("atlantic") || div === "atl";
}

function isMetropolitan(row: any) {
  const div = getDivisionName(row).toLowerCase();
  return div.includes("metropolitan") || div === "met";
}

function compareDivisionRank(a: any, b: any) {
  const da = typeof a?.divisionSequence === "number" ? a.divisionSequence : null;
  const db = typeof b?.divisionSequence === "number" ? b.divisionSequence : null;

  if (da != null && db != null) return da - db;
  if (da != null && db == null) return -1;
  if (da == null && db != null) return 1;

  const pa = typeof a?.points === "number" ? a.points : 0;
  const pb = typeof b?.points === "number" ? b.points : 0;
  if (pb !== pa) return pb - pa;

  const rwa = typeof a?.regulationWins === "number" ? a.regulationWins : 0;
  const rwb = typeof b?.regulationWins === "number" ? b.regulationWins : 0;
  if (rwb !== rwa) return rwb - rwa;

  const wa = typeof a?.wins === "number" ? a.wins : 0;
  const wb = typeof b?.wins === "number" ? b.wins : 0;
  return wb - wa;
}

function compareWildcard(a: any, b: any) {
  const wa = typeof a?.wildcardSequence === "number" ? a.wildcardSequence : null;
  const wb = typeof b?.wildcardSequence === "number" ? b.wildcardSequence : null;

  if (wa != null && wb != null) return wa - wb;
  if (wa != null && wb == null) return -1;
  if (wa == null && wb != null) return 1;

  const pa = typeof a?.points === "number" ? a.points : 0;
  const pb = typeof b?.points === "number" ? b.points : 0;
  if (pb !== pa) return pb - pa;

  const rwa = typeof a?.regulationWins === "number" ? a.regulationWins : 0;
  const rwb = typeof b?.regulationWins === "number" ? b.regulationWins : 0;
  if (rwb !== rwa) return rwb - rwa;

  const wa2 = typeof a?.wins === "number" ? a.wins : 0;
  const wb2 = typeof b?.wins === "number" ? b.wins : 0;
  return wb2 - wa2;
}

function buildEastPlayoffPicture(payload: any) {
  const rows: any[] = Array.isArray(payload?.standings) ? payload.standings : [];
  const east = rows.filter(isEastern);

  const atl = east.filter(isAtlantic).sort(compareDivisionRank).slice(0, 3);
  const met = east.filter(isMetropolitan).sort(compareDivisionRank).slice(0, 3);

  // EXCLUDE those 6 teams by a stable key (id/abbrev/name)
  const picked = new Set<string>();
  for (const r of [...atl, ...met]) picked.add(teamKey(r));

  const remaining = east.filter((r) => !picked.has(teamKey(r)));
  const wildcards = remaining.sort(compareWildcard).slice(0, 2);

  const atlLabeled = atl.map((r, i) => ({ ...r, _slot: `A${i + 1}` }));
  const metLabeled = met.map((r, i) => ({ ...r, _slot: `M${i + 1}` }));
  const wcLabeled = wildcards.map((r, i) => ({ ...r, _slot: `WC${i + 1}` }));

  return { atlantic: atlLabeled, metropolitan: metLabeled, wildcards: wcLabeled };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const noCache = searchParams.get("nocache") === "1";

  const upstream = "https://api-web.nhle.com/v1/standings/now";

  try {
    const res = await fetch(upstream, {
      cache: noCache ? "no-store" : "force-cache",
      next: noCache ? undefined : { revalidate: 3600 },
      headers: {
        "User-Agent": "ncx-secret-nhl-east-playoffs",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, upstream, status: res.status, statusText: res.statusText },
        { status: 502 }
      );
    }

    const raw = await res.json();
    const picture = buildEastPlayoffPicture(raw);

    return json({
      ok: true,
      upstream,
      updatedAt: new Date().toISOString(),
      title: "Eastern Conference Playoff Picture",
      ...picture,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, upstream, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}