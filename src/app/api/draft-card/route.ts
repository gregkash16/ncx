// src/app/api/draft-card/route.ts
import React from "react";
import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CARD_W = 1920;
const CARD_H = 1080;

const FACTION_LOGO_KEY: Record<string, string> = {
  REPUBLIC: "republic",
  CIS: "cis",
  REBELS: "rebels",
  EMPIRE: "empire",
  RESISTANCE: "resistance",
  "FIRST ORDER": "first_order",
  SCUM: "scum",
};

function factionLogoKey(v: unknown) {
  const k = normFaction(v);
  return FACTION_LOGO_KEY[k] || "";
}

const E = React.createElement;

function norm(v: any) {
  return v != null ? String(v).trim() : "";
}

function safeUrl(u: string) {
  try {
    return new URL(u).toString();
  } catch {
    return "";
  }
}

function pct(winPct: number) {
  if (!isFinite(winPct)) return "—";
  const val = winPct <= 1 ? winPct * 100 : winPct;
  return `${val.toFixed(1)}%`;
}

function getOrigin(req: NextRequest) {
  const proto = req.headers.get("x-forwarded-proto") || "http";
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "localhost:3000";
  return `${proto}://${host}`;
}

function normFaction(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toUpperCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function isAdminBypass(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const provided = norm(searchParams.get("key"));
  const expected = norm(process.env.DRAFT_CARD_ADMIN_KEY || "");
  return !!expected && provided === expected;
}

async function fetchAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Image fetch failed (${res.status}) for ${url}`);

  const contentType = res.headers.get("content-type") || "image/png";
  const ab = await res.arrayBuffer();
  const b64 = Buffer.from(ab).toString("base64");
  return `data:${contentType};base64,${b64}`;
}

export async function GET(req: NextRequest) {
  try {
    const origin = getOrigin(req);
    const { searchParams } = new URL(req.url);

    const adminBypass = isAdminBypass(req);

    // Optional overrides for admin testing
    const oFirst = norm(searchParams.get("first"));
    const oLast = norm(searchParams.get("last"));
    const oDiscord = norm(searchParams.get("discord"));
    const oP1 = norm(searchParams.get("p1"));
    const oP2 = norm(searchParams.get("p2"));
    const oP3 = norm(searchParams.get("p3"));

    const ncxid = norm(searchParams.get("ncxid"));
    const img = safeUrl(norm(searchParams.get("img")));
    if (!ncxid) return new Response("Missing ncxid", { status: 400 });

    const [atRows] = await pool.query<any[]>(
      `
      SELECT
        ncxid,
        first_name,
        last_name,
        discord,
        wins,
        losses,
        points,
        plms,
        games,
        win_pct,
        ppg,
        s1, s2, s3, s4, s5, s6, s7, s8,
        championships
      FROM S8.all_time_stats
      WHERE ncxid = ?
      LIMIT 1
      `,
      [ncxid]
    );
    const at = atRows?.[0] ?? null;

    const [s9Rows] = await pool.query<any[]>(
      `
      SELECT ncxid, first_name, last_name, pref_one, pref_two, pref_three
      FROM S9.signups
      WHERE ncxid = ?
      LIMIT 1
      `,
      [ncxid]
    );
    const s9 = s9Rows?.[0] ?? null;

    const first = adminBypass ? (oFirst || norm(at?.first_name) || "") : norm(s9?.first_name || at?.first_name);
    const last = adminBypass ? (oLast || norm(at?.last_name) || "") : norm(s9?.last_name || at?.last_name);
    const discord = adminBypass ? (oDiscord || norm(at?.discord) || "") : norm(at?.discord);

    const prefs = adminBypass
      ? [oP1, oP2, oP3].filter(Boolean)
      : [norm(s9?.pref_one), norm(s9?.pref_two), norm(s9?.pref_three)].filter(Boolean);


    // ✅ Use PNG logo endpoint (now returns actual PNG bytes, no redirect)
    // PNG logo endpoint (returns actual PNG bytes)
  const logoPngUrls = prefs.slice(0, 3).map((p) => {
  const key = normFaction(p); // yields CIS / FIRST ORDER / etc
  return key ? `${origin}/api/faction-logo?faction=${encodeURIComponent(key)}` : "";
});


    const prefLogoDataUrls = await Promise.all(
      logoPngUrls.map(async (u) => {
        if (!u) return "";
        try {
          return await fetchAsDataUrl(u);
        } catch (e) {
          console.error("logo fetch failed:", u, e);
          return "";
        }
      })
    );

    const seasonRows: Array<{ season: string; text: string }> = [];
    for (let i = 1; i <= 8; i++) {
      const text = norm(at?.[`s${i}`]);
      if (text) seasonRows.push({ season: `Season ${i}`, text });
    }

    const wins = Number(at?.wins ?? 0);
    const losses = Number(at?.losses ?? 0);
    const games = Number(at?.games ?? 0);
    const winPct = Number(at?.win_pct ?? 0);
    const ppg = Number(at?.ppg ?? 0);
    const points = Number(at?.points ?? 0);
    const plms = Number(at?.plms ?? 0);
    const championships = norm(at?.championships);

    const displayName =
      first || last ? `${first} ${last}`.trim() : `NCX ${ncxid}`;

    const HEADSHOT_W = 552;
    const HEADSHOT_H = 720;
    const LOGO_W = 52;
    const LOGO_H = 52;

    return new ImageResponse(
      E(
        "div",
        {
          style: {
            width: "100%",
            height: "100%",
            display: "flex",
            background:
              "linear-gradient(135deg, #05060a 0%, #0b1020 55%, #02030a 100%)",
            color: "#e5e7eb",
            fontFamily:
              "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto",
          },
        },

        // LEFT
        E(
          "div",
          {
            style: {
              width: 640,
              height: "100%",
              padding: 44,
              display: "flex",
              flexDirection: "column",
              gap: 18,
            },
          },

          E(
            "div",
            {
              style: {
                width: HEADSHOT_W,
                height: HEADSHOT_H,
                borderRadius: 32,
                overflow: "hidden",
                border: "2px solid rgba(56,189,248,0.22)",
                background: "rgba(255,255,255,0.04)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              },
            },
            img
              ? E("img", {
                  src: img,
                  alt: "headshot",
                  width: HEADSHOT_W,
                  height: HEADSHOT_H,
                  style: { width: "100%", height: "100%", objectFit: "cover" },
                })
              : E(
                  "div",
                  { style: { opacity: 0.75, fontSize: 28 } },
                  "No headshot"
                )
          ),

          E(
            "div",
            { style: { display: "flex", gap: 12, flexWrap: "wrap" } },
            E(
              "div",
              {
                style: {
                  padding: "10px 14px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.06)",
                  fontSize: 20,
                },
              },
              `NCX ${ncxid}`
            ),
            championships
              ? E(
                  "div",
                  {
                    style: {
                      padding: "10px 14px",
                      borderRadius: 999,
                      border: "1px solid rgba(236,72,153,0.36)",
                      background: "rgba(236,72,153,0.12)",
                      fontSize: 20,
                    },
                  },
                  `🏆 ${championships}`
                )
              : null
          )
        ),

        // RIGHT
        E(
          "div",
          {
            style: {
              flex: 1,
              height: "100%",
              padding: 52,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: 26,
            },
          },

          E(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: 12 } },
            E(
              "div",
              { style: { fontSize: 24, letterSpacing: 2, opacity: 0.85 } },
              "NICKEL CITY X-WING • SEASON 9 DRAFT CARD"
            ),
            E(
              "div",
              { style: { fontSize: 74, fontWeight: 850, lineHeight: 1.05 } },
              displayName
            ),
            discord
              ? E("div", { style: { fontSize: 26, opacity: 0.82 } }, discord)
              : null
          ),

          // Prefs with logo PNGs (data URLs)
          E(
            "div",
            {
              style: {
                borderRadius: 28,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.04)",
                padding: 28,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              },
            },
            E(
              "div",
              { style: { fontSize: 22, letterSpacing: 1, opacity: 0.85 } },
              "FACTION PREFERENCES"
            ),
            E(
              "div",
              { style: { display: "flex", gap: 16 } },
              ...[0, 1, 2].map((i) => {
                const label = prefs[i] || "—";
                const logo = prefLogoDataUrls[i] || "";

                return E(
                  "div",
                  {
                    key: `pref-${i}`,
                    style: {
                      flex: 1,
                      borderRadius: 22,
                      border: "1px solid rgba(56,189,248,0.20)",
                      background:
                        "linear-gradient(90deg, rgba(236,72,153,0.16), rgba(168,85,247,0.12), rgba(56,189,248,0.10))",
                      padding: 16,
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      minHeight: 82,
                    },
                  },
                  logo
                    ? E("img", {
                        src: logo,
                        alt: label,
                        width: LOGO_W,
                        height: LOGO_H,
                        style: {
                          width: LOGO_W,
                          height: LOGO_H,
                          objectFit: "contain",
                        },
                      })
                    : null,
                  E(
                    "div",
                    { style: { display: "flex", flexDirection: "column", gap: 4 } },
                    E(
                      "div",
                      { style: { fontSize: 18, opacity: 0.85, letterSpacing: 1 } },
                      `PREF ${i + 1}`
                    ),
                    E("div", { style: { fontSize: 26, fontWeight: 850 } }, label)
                  )
                );
              })
            )
          ),

          // Stats
          E(
            "div",
            { style: { display: "flex", gap: 18 } },
            ...[
              { label: "GAMES", value: String(games || 0) },
              { label: "W-L", value: `${wins}-${losses}` },
              { label: "WIN%", value: pct(winPct) },
              { label: "PPG", value: isFinite(ppg) ? ppg.toFixed(2) : "—" },
            ].map((s) =>
              E(
                "div",
                {
                  key: s.label,
                  style: {
                    flex: 1,
                    borderRadius: 24,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.04)",
                    padding: 22,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  },
                },
                E("div", { style: { fontSize: 18, letterSpacing: 1, opacity: 0.8 } }, s.label),
                E("div", { style: { fontSize: 44, fontWeight: 850 } }, s.value)
              )
            )
          ),

          // Totals + seasons
          E(
            "div",
            { style: { display: "flex", gap: 18 } },
            E(
              "div",
              {
                style: {
                  flex: 1,
                  borderRadius: 28,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.03)",
                  padding: 26,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                },
              },
              E("div", { style: { fontSize: 20, letterSpacing: 1, opacity: 0.85 } }, "CAREER TOTALS"),
              E(
                "div",
                { style: { fontSize: 26, opacity: 0.9 } },
                `Points: ${isFinite(points) ? points : 0} • PL/MS: ${isFinite(plms) ? plms : 0}`
              )
            ),
            E(
              "div",
              {
                style: {
                  flex: 1,
                  borderRadius: 28,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.03)",
                  padding: 26,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                },
              },
              E("div", { style: { fontSize: 20, letterSpacing: 1, opacity: 0.85 } }, "SEASON HISTORY"),
              seasonRows.length
                ? E(
                    "div",
                    { style: { display: "flex", flexDirection: "column", gap: 10 } },
                    ...seasonRows.map((s) =>
                      E(
                        "div",
                        { key: s.season, style: { display: "flex", gap: 12, alignItems: "baseline" } },
                        E("div", { style: { width: 110, fontSize: 18, opacity: 0.8 } }, s.season),
                        E("div", { style: { fontSize: 20, opacity: 0.95 } }, s.text)
                      )
                    )
                  )
                : E("div", { style: { fontSize: 20, opacity: 0.8 } }, "No prior seasons found")
            )
          ),

          E("div", { style: { fontSize: 18, opacity: 0.55, letterSpacing: 1 } }, "Generated by nickelcityxwing.com")
        )
      ),
      { width: CARD_W, height: CARD_H }
    );
  } catch (err: any) {
    console.error("GET /api/draft-card error:", err);
    return new Response(`Error: ${err?.message ?? "SERVER_ERROR"}`, { status: 500 });
  }
}
