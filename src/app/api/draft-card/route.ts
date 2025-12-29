import React from "react";
import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CARD_W = 1920;
const CARD_H = 1080;

const E = React.createElement;

/* ---------------- helpers ---------------- */

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

function normFaction(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toUpperCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function getOrigin(req: NextRequest) {
  const proto = req.headers.get("x-forwarded-proto") || "http";
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "localhost:3000";
  return `${proto}://${host}`;
}

function isAdminBypass(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const provided = norm(searchParams.get("key"));
  const expected = norm(process.env.DRAFT_CARD_ADMIN_KEY || "");
  return !!expected && provided === expected;
}

async function fetchAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(
      `Image fetch failed (${res.status}) for ${url} :: ${txt.slice(0, 120)}`
    );
  }

  const contentType = res.headers.get("content-type") || "image/png";
  const ab = await res.arrayBuffer();
  const b64 = Buffer.from(ab).toString("base64");
  return `data:${contentType};base64,${b64}`;
}

/* ---------------- handler ---------------- */

export async function GET(req: NextRequest) {
  try {
    const { pool } = await import("@/lib/db");

    const origin = getOrigin(req);
    const { searchParams } = new URL(req.url);

    const adminBypass = isAdminBypass(req);

    const ncxid = norm(searchParams.get("ncxid"));
    const img = safeUrl(norm(searchParams.get("img")));

    if (!ncxid) return new Response("Missing ncxid", { status: 400 });

    // admin overrides
    const oFirst = norm(searchParams.get("first"));
    const oLast = norm(searchParams.get("last"));
    const oDiscord = norm(searchParams.get("discord"));
    const oP1 = norm(searchParams.get("p1"));
    const oP2 = norm(searchParams.get("p2"));
    const oP3 = norm(searchParams.get("p3"));

    /* ---------- DB lookups (fully safe) ---------- */

    let at: any = null;
    try {
      const [rows] = await pool.query<any[]>(
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
      at = rows?.[0] ?? null;
    } catch (e) {
      console.error("draft-card all_time_stats failed", e);
    }

    let s9: any = null;
    try {
      const [rows] = await pool.query<any[]>(
        `
        SELECT ncxid, first_name, last_name, pref_one, pref_two, pref_three
        FROM S9.signups
        WHERE ncxid = ?
        LIMIT 1
        `,
        [ncxid]
      );
      s9 = rows?.[0] ?? null;
    } catch (e) {
      console.error("draft-card S9 signups failed", e);
    }

    /* ---------- identity ---------- */

    const first = adminBypass
      ? oFirst || norm(at?.first_name)
      : norm(s9?.first_name || at?.first_name);

    const last = adminBypass
      ? oLast || norm(at?.last_name)
      : norm(s9?.last_name || at?.last_name);

    const discord = adminBypass
      ? oDiscord || norm(at?.discord)
      : norm(at?.discord);

    const prefs = adminBypass
      ? [oP1, oP2, oP3].filter(Boolean)
      : [norm(s9?.pref_one), norm(s9?.pref_two), norm(s9?.pref_three)].filter(Boolean);

    /* ---------- faction logos ---------- */

    const logoUrls = prefs.slice(0, 3).map((p) => {
      const key = normFaction(p);
      return key ? `${origin}/api/faction-logo?faction=${encodeURIComponent(key)}` : "";
    });

    const prefLogoDataUrls = await Promise.all(
      logoUrls.map(async (u) => {
        if (!u) return "";
        try {
          return await fetchAsDataUrl(u);
        } catch (e) {
          console.error("logo fetch failed", u, e);
          return "";
        }
      })
    );

    /* ---------- stats ---------- */

    const wins = Number(at?.wins ?? 0);
    const losses = Number(at?.losses ?? 0);
    const games = Number(at?.games ?? 0);
    const winPct = Number(at?.win_pct ?? 0);
    const ppg = Number(at?.ppg ?? 0);
    const points = Number(at?.points ?? 0);
    const plms = Number(at?.plms ?? 0);
    const championships = norm(at?.championships);

    const seasonRows: Array<{ season: string; text: string }> = [];
    for (let i = 1; i <= 8; i++) {
      const t = norm(at?.[`s${i}`]);
      if (t) seasonRows.push({ season: `Season ${i}`, text: t });
    }

    const displayName =
      first || last ? `${first} ${last}`.trim() : `NCX ${ncxid}`;

    /* ---------- render ---------- */

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
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              },
            },
            img
              ? E("img", {
                  src: img,
                  width: HEADSHOT_W,
                  height: HEADSHOT_H,
                  style: { objectFit: "cover" },
                })
              : E("div", { style: { fontSize: 28, opacity: 0.7 } }, "No headshot")
          )
        ),

        // RIGHT
        E(
          "div",
          {
            style: {
              flex: 1,
              padding: 52,
              display: "flex",
              flexDirection: "column",
              gap: 26,
            },
          },
          E("div", { style: { fontSize: 74, fontWeight: 850 } }, displayName),

          // prefs
          E(
            "div",
            { style: { display: "flex", gap: 16 } },
            ...[0, 1, 2].map((i) => {
              const label = prefs[i] || "—";
              const logo = prefLogoDataUrls[i];
              return E(
                "div",
                {
                  key: i,
                  style: {
                    flex: 1,
                    padding: 16,
                    borderRadius: 22,
                    display: "flex",
                    gap: 14,
                    alignItems: "center",
                    background:
                      "linear-gradient(90deg, rgba(236,72,153,0.16), rgba(168,85,247,0.12), rgba(56,189,248,0.10))",
                  },
                },
                logo &&
                  E("img", {
                    src: logo,
                    width: LOGO_W,
                    height: LOGO_H,
                  }),
                E("div", null, label)
              );
            })
          ),

          E("div", null, `W-L: ${wins}-${losses}`),
          E("div", null, `WIN%: ${pct(winPct)}`),
          E("div", null, `PPG: ${isFinite(ppg) ? ppg.toFixed(2) : "—"}`),
          E("div", null, `Points: ${points} • PL/MS: ${plms}`),
          championships && E("div", null, `🏆 ${championships}`)
        )
      ),
      { width: CARD_W, height: CARD_H }
    );
  } catch (err: any) {
    console.error("draft-card fatal error", err);
    return new Response(`Error: ${err?.message ?? "SERVER_ERROR"}`, {
      status: 500,
    });
  }
}
