// src/lib/matchupsDb.ts
import type { RowDataPacket } from "mysql2";
import { getMysqlPool } from "./mysql";
import type { MatchRow } from "@/lib/googleSheets";

/**
 * Shape of a row from your MySQL S8_matchups table.
 * Only include the columns you actually select in the query.
 */
interface DbMatchRow extends RowDataPacket {
  week: string;            // e.g. "WEEK 1"
  game: string | number;
  away_id: string | null;
  away_name: string | null;
  away_team: string | null;
  away_pts: number | null;
  home_id: string | null;
  home_name: string | null;
  home_team: string | null;
  home_pts: number | null;
  scenario: string | null;
}

/**
 * Normalize "week" text: "week 3", "Week 3", "WEEK 3" -> "WEEK 3"
 */
export function normalizeWeekLabel(label?: string | null): string {
  if (!label) return "WEEK 1";
  const s = String(label).trim();
  const m = s.match(/week\s*(\d+)/i);
  if (m) return `WEEK ${m[1]}`;
  return s.toUpperCase();
}

/**
 * Get the "active" week from MySQL.
 * For now: just take the highest week number present in the table.
 */
export async function getActiveWeekFromDb(): Promise<string> {
  const pool = getMysqlPool();

  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT DISTINCT week
      FROM S8_matchups
      WHERE week IS NOT NULL AND week <> ''
    `
  );

  if (!rows.length) return "WEEK 1";

  const weekNums = rows
    .map((r) => normalizeWeekLabel(r.week as string))
    .map((w) => {
      const m = w.match(/WEEK\s*(\d+)/i);
      return m ? { label: w, num: parseInt(m[1], 10) } : null;
    })
    .filter((x): x is { label: string; num: number } => !!x)
    .sort((a, b) => a.num - b.num);

  return weekNums.length ? weekNums[weekNums.length - 1].label : "WEEK 1";
}

/**
 * Load all matchups for a given week label from MySQL and
 * map them into the MatchRow shape used by the UI.
 */
export async function getMatchupsForWeek(
  weekLabel: string
): Promise<MatchRow[]> {
  const pool = getMysqlPool();
  const week = normalizeWeekLabel(weekLabel);

  const [rows] = await pool.query<DbMatchRow[]>(
    `
      SELECT
        week,
        game,
        away_id,
        away_name,
        away_team,
        away_pts,
        home_id,
        home_name,
        home_team,
        home_pts,
        scenario
      FROM S8_matchups
      WHERE week = ?
      ORDER BY CAST(game AS UNSIGNED)
    `,
    [week]
  );

  const mapped: MatchRow[] = rows.map((r, idx) => {
    // seriesNo must be a number
    const gameNum = Number(String(r.game ?? "").trim());
    const seriesNo =
      Number.isFinite(gameNum) && gameNum > 0 ? gameNum : idx + 1;

    return {
      week: String(r.week),

      // ✅ number, not string
      seriesNo,

      game: String(r.game),

      awayId: String(r.away_id ?? ""),
      awayName: String(r.away_name ?? ""),
      awayTeam: String(r.away_team ?? ""),
      awayPts: r.away_pts != null ? String(r.away_pts) : "",

      // Series / PLMS stats – not in this query, so keep them empty for now.
      awayW: "",
      awayL: "",
      awayPLMS: "",

      homeId: String(r.home_id ?? ""),
      homeName: String(r.home_name ?? ""),
      homeTeam: String(r.home_team ?? ""),
      homePts: r.home_pts != null ? String(r.home_pts) : "",

      homeW: "",
      homeL: "",
      homePLMS: "",

      scenario: String(r.scenario ?? ""),
    };
  });

  return mapped;
}
