// src/lib/matchupsDb.ts

import type { RowDataPacket } from "mysql2";
import { pool } from "@/lib/db";
import type { MatchRow } from "@/lib/googleSheets";

/**
 * Shape of a row from the MySQL weekly_matchups table.
 */
interface DbMatchRow extends RowDataPacket {
  week_label: string;
  game: string | number;
  awayId: string | null;
  awayName: string | null;
  awayTeam: string | null;
  awayPts: number | null;
  homeId: string | null;
  homeName: string | null;
  homeTeam: string | null;
  homePts: number | null;
  scenario: string | null;
}

/**
 * Normalize "week" text:
 * "week 3", "Week 3", "WEEK 3" → "WEEK 3"
 */
export function normalizeWeekLabel(label?: string | null): string {
  if (!label) return "WEEK 1";
  const s = String(label).trim();
  const m = s.match(/week\s*(\d+)/i);
  if (m) return `WEEK ${m[1]}`;
  return s.toUpperCase();
}

/**
 * Determine the active week from MySQL.
 * Uses the highest WEEK N found in weekly_matchups.
 */
export async function getActiveWeekFromDb(): Promise<string> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT DISTINCT week_label
      FROM weekly_matchups
      WHERE week_label IS NOT NULL AND week_label <> ''
    `
  );

  if (!rows.length) return "WEEK 1";

  const weeks = rows
    .map((r) => normalizeWeekLabel((r as any).week_label))
    .map((w) => {
      const m = w.match(/WEEK\s*(\d+)/i);
      return m ? { label: w, num: parseInt(m[1], 10) } : null;
    })
    .filter((x): x is { label: string; num: number } => !!x)
    .sort((a, b) => a.num - b.num);

  return weeks.length ? weeks[weeks.length - 1].label : "WEEK 1";
}

/**
 * Load all matchups for a given week label and map them
 * into the MatchRow shape used by the UI.
 */
export async function getMatchupsForWeek(
  weekLabel: string
): Promise<MatchRow[]> {
  const week = normalizeWeekLabel(weekLabel);

  const [rows] = await pool.query<DbMatchRow[]>(
    `
      SELECT
        week_label,
        game,
        awayId,
        awayName,
        awayTeam,
        awayPts,
        homeId,
        homeName,
        homeTeam,
        homePts,
        scenario
      FROM weekly_matchups
      WHERE week_label = ?
      ORDER BY CAST(game AS UNSIGNED)
    `,
    [week]
  );

  return rows.map((r, idx) => {
    const gameNum = Number(String(r.game ?? "").trim());

    const seriesNo =
      Number.isFinite(gameNum) && gameNum > 0 ? gameNum : idx + 1;

    const row: MatchRow = {
      game: String(r.game ?? ""),
      seriesNo,

      awayId: String(r.awayId ?? ""),
      awayName: String(r.awayName ?? ""),
      awayTeam: String(r.awayTeam ?? ""),
      awayW: "",
      awayL: "",
      awayPts: r.awayPts != null ? String(r.awayPts) : "",
      awayPLMS: "",

      homeId: String(r.homeId ?? ""),
      homeName: String(r.homeName ?? ""),
      homeTeam: String(r.homeTeam ?? ""),
      homeW: "",
      homeL: "",
      homePts: r.homePts != null ? String(r.homePts) : "",
      homePLMS: "",

      scenario: String(r.scenario ?? ""),
    };

    return row;
  });
}
