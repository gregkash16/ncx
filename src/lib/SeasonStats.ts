// src/lib/SeasonStats.ts
import mysql from "mysql2/promise";

const DB_HOST = process.env.DB_HOST || "metro.proxy.rlwy.net";
const DB_PORT = Number(process.env.DB_PORT || 47124);
const DB_USER = process.env.DB_USER || "root";
const DB_PASSWORD = process.env.MYSQLPASSWORD || "";

function makePool(database: string): mysql.Pool {
  return mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database,
    waitForConnections: true,
    connectionLimit: 3,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });
}

const g = globalThis as unknown as {
  _ncxPoolRailway: mysql.Pool | undefined;
  _ncxPoolS8: mysql.Pool | undefined;
};

function getPool(db: "railway" | "S8"): mysql.Pool {
  if (db === "S8") {
    g._ncxPoolS8 ??= makePool("S8");
    return g._ncxPoolS8;
  }
  g._ncxPoolRailway ??= makePool("railway");
  return g._ncxPoolRailway;
}

export type SeasonNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type StatsMode = "overall" | "individual";

function resolveTable(
  season: SeasonNumber,
  mode: StatsMode
): { db: "railway" | "S8"; table: string } {
  if (season === 8) {
    return {
      db: "S8",
      table: mode === "overall" ? "overall_standings" : "individual_stats",
    };
  }
  return {
    db: "railway",
    table: mode === "overall" ? `S${season}_Overall` : `S${season}_Individual_Stats`,
  };
}

export type SeasonStatsResult = {
  columns: string[];
  rows: Record<string, unknown>[];
};

// Desired column order for S8 overall
const S8_OVERALL_COLUMNS = ["rank", "team", "wins", "losses", "game_wins", "points"];

export async function fetchSeasonStats(
  season: SeasonNumber,
  mode: StatsMode
): Promise<SeasonStatsResult> {
  const { db, table } = resolveTable(season, mode);
  const pool = getPool(db);

  // S8 overall: order rows by rank, and pin column order with explicit SELECT
  const query =
    db === "S8" && mode === "overall"
      ? "SELECT `rank`, `team`, `wins`, `losses`, `game_wins`, `points` FROM `overall_standings` ORDER BY `rank` ASC"
      : `SELECT * FROM \`${table}\``;

  const [rows] = await pool.query(query);
  const rowsArr = rows as Record<string, unknown>[];

  if (rowsArr.length === 0) {
    return { columns: [], rows: [] };
  }

  const columns =
    db === "S8" && mode === "overall"
      ? S8_OVERALL_COLUMNS
      : Object.keys(rowsArr[0]);

  return { columns, rows: rowsArr };
}