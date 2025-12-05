// src/lib/mysqlSync.ts
import mysql from "mysql2/promise";

function norm(v: any): string {
  return v != null ? String(v).trim() : "";
}

function toDecimalOrNone(s: string | null | undefined): number | null {
  let raw = (s ?? "").trim();
  if (!raw) return null;

  const upper = raw.toUpperCase();
  if (["#DIV/0!", "#VALUE!", "N/A", "NA"].includes(upper)) return null;

  if (raw.endsWith("%")) raw = raw.slice(0, -1).trim();
  const val = Number(raw);
  return Number.isFinite(val) ? val : null;
}

function toIntOrNone(s: string | null | undefined): number | null {
  const raw = (s ?? "").trim();
  if (!raw) return null;
  const val = Number(raw);
  return Number.isInteger(val) ? val : null;
}

function toIntOrZero(v: any): number {
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function parseWinCell(v: any): number {
  const s = String(v ?? "").trim().toUpperCase();
  if (["WIN", "W", "1"].includes(s)) return 1;
  if (["LOSS", "L", "", "-", "0"].includes(s)) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? (n > 0 ? 1 : 0) : 0;
}

function parseLossCell(v: any): number {
  const s = String(v ?? "").trim().toUpperCase();
  if (["LOSS", "L", "1"].includes(s)) return 1;
  if (["WIN", "W", "", "-", "0"].includes(s)) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? (n > 0 ? 1 : 0) : 0;
}

function normalizeWeekLabel(label: string): string {
  const s = (label ?? "").trim();
  if (!s) return "WEEK 1";

  const m1 = s.match(/week\s*(\d+)/i);
  if (m1) return `WEEK ${parseInt(m1[1], 10)}`;

  const num = Number(s);
  if (Number.isInteger(num) && num > 0) {
    return `WEEK ${num}`;
  }
  return s.toUpperCase();
}

// sheets: whatever getSheets() returns (google.sheets client)
type SheetsClient = any;

export async function getMySqlConn() {
  const host = process.env.DB_HOST ?? "localhost";
  const port = Number(process.env.DB_PORT ?? "3306");
  const user = process.env.DB_USER ?? "root";
  const password = process.env.DB_PASSWORD ?? process.env.MYSQLPASSWORD;
  const database = process.env.DB_NAME ?? "S8";

  if (!password) {
    throw new Error("Missing DB_PASSWORD / MYSQLPASSWORD");
  }

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: false,
  });

  return conn;
}

/* ---------------- current_week ---------------- */

export async function syncCurrentWeek(
  sheets: SheetsClient,
  spreadsheetId: string,
  conn: mysql.Connection
) {
  const weekRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "SCHEDULE!U2",
    valueRenderOption: "FORMATTED_VALUE",
  });
  const raw = weekRes.data.values?.[0]?.[0] ?? "WEEK 1";
  const weekLabel = normalizeWeekLabel(String(raw));

  await conn.execute("DELETE FROM current_week");
  await conn.execute("INSERT INTO current_week (week_label) VALUES (?)", [
    weekLabel,
  ]);

  return weekLabel;
}

/* ------------- weekly_matchups (single row) ------------- */

export async function syncSingleWeeklyMatchup(
  sheets: SheetsClient,
  spreadsheetId: string,
  weekTab: string,
  rowNum: number,
  conn: mysql.Connection
) {
  const range = `${weekTab}!A${rowNum}:Q${rowNum}`;
  const rowRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const r0 = rowRes.data.values?.[0];
  if (!r0) return;

  const r = [
    ...r0,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ].slice(0, 17);

  const gameRaw = norm(r[0]);
  const gameNum = parseInt(gameRaw, 10);
  if (!Number.isFinite(gameNum) || gameNum <= 0) return;
  const game = String(gameNum);
  const weekLabel = normalizeWeekLabel(weekTab);

  const awayId = norm(r[1]);
  const awayName = norm(r[2]);
  const awayTeam = norm(r[3]);
  const awayW = norm(r[4]);
  const awayL = norm(r[5]);
  const awayPts = norm(r[6]);
  const awayPLMS = norm(r[7]);
  const homeId = norm(r[9]);
  const homeName = norm(r[10]);
  const homeTeam = norm(r[11]);
  const homeW = norm(r[12]);
  const homeL = norm(r[13]);
  const homePts = norm(r[14]);
  const homePLMS = norm(r[15]);
  const scenario = norm(r[16]);

  if (!awayTeam && !homeTeam) return;

  // Delete old row for that week+game and insert fresh
  await conn.execute(
    "DELETE FROM weekly_matchups WHERE week_label = ? AND game = ?",
    [weekLabel, game]
  );

  const sql = `
    INSERT INTO weekly_matchups (
      week_label,
      game,
      awayId,
      awayName,
      awayTeam,
      awayW,
      awayL,
      awayPts,
      awayPLMS,
      homeId,
      homeName,
      homeTeam,
      homeW,
      homeL,
      homePts,
      homePLMS,
      scenario
    ) VALUES (
      ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
    )
  `;

  await conn.execute(sql, [
    weekLabel,
    game,
    awayId,
    awayName,
    awayTeam,
    parseWinCell(awayW),
    parseLossCell(awayL),
    toIntOrZero(awayPts),
    toIntOrZero(awayPLMS),
    homeId,
    homeName,
    homeTeam,
    parseWinCell(homeW),
    parseLossCell(homeL),
    toIntOrZero(homePts),
    toIntOrZero(homePLMS),
    scenario,
  ]);
}

/* ---------------- individual_stats ---------------- */

export async function syncIndividualStats(
  sheets: SheetsClient,
  spreadsheetId: string,
  conn: mysql.Connection
) {
  const rowsRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "INDIVIDUAL!A2:V",
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = (rowsRes.data.values ?? []) as string[][];

  await conn.execute("DELETE FROM individual_stats");

  const sql = `
    INSERT INTO individual_stats (
      \`rank\`, ncxid, first_name, last_name, discord,
      pick_no, team, faction, wins, losses, points,
      plms, games, winper, ppg, efficiency, war,
      h2h, potato, sos
    ) VALUES (
      ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
    )
  `;

  for (const r0 of rows) {
    if (!r0 || r0.length === 0) continue;
    const r = [
      ...r0,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ].slice(0, 22);

    const rankStr = norm(r[0]);
    if (!rankStr) continue;
    const rank = parseInt(rankStr, 10);
    if (!Number.isFinite(rank)) continue;

    const ncxid = norm(r[1]);
    const first = norm(r[2]);
    const last = norm(r[3]);
    const discord = norm(r[4]);
    const pick = norm(r[5]);
    const team = norm(r[6]);
    const faction = norm(r[7]);
    const wins = toIntOrZero(r[8]);
    const losses = toIntOrZero(r[9]);
    const points = toIntOrZero(r[10]);
    const plms = toIntOrZero(r[11]);
    const games = toIntOrZero(r[12]);
    const winper = norm(r[13]) || null;
    const ppg = norm(r[14]) || null;
    const efficiency = toIntOrZero(r[15]);
    const war = norm(r[16]) || null;
    const h2h = norm(r[17]) || null;
    const potato = norm(r[18]) || null;
    const sos = norm(r[19]) || null;

    await conn.execute(sql, [
      rank,
      ncxid,
      first,
      last,
      discord,
      pick ? parseInt(pick, 10) : null,
      team,
      faction,
      wins,
      losses,
      points,
      plms,
      games,
      winper,
      ppg,
      efficiency,
      war,
      h2h,
      potato,
      sos,
    ]);
  }
}

/* ---------------- adv_stats (t1..t5) ---------------- */

export async function syncAdvStats(
  sheets: SheetsClient,
  spreadsheetId: string,
  conn: mysql.Connection
) {
  // t1: A2:N25
  await conn.execute("DELETE FROM adv_stats_t1");
  {
    const rowsRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "ADV STATS!A2:N25",
      valueRenderOption: "FORMATTED_VALUE",
    });
    const rows = (rowsRes.data.values ?? []) as string[][];
    const sql = `
      INSERT INTO adv_stats_t1 (
        team, total_games, avg_wins, avg_loss, avg_points,
        avg_plms, avg_games, avg_win_pct, avg_ppg,
        avg_efficiency, avg_war, avg_h2h, avg_potato, avg_sos
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `;
    for (const r0 of rows) {
      const r = [
        ...r0,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ].slice(0, 14);
      const team = norm(r[0]);
      if (!team) continue;
      await conn.execute(sql, r.map(norm));
    }
  }

  // t2: A28:I32
  await conn.execute("DELETE FROM adv_stats_t2");
  {
    const rowsRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "ADV STATS!A28:I32",
      valueRenderOption: "FORMATTED_VALUE",
    });
    const rows = (rowsRes.data.values ?? []) as string[][];
    const sql = `
      INSERT INTO adv_stats_t2 (
        scenario, avg_home_pts, avg_away_pts, avg_total_pts,
        avg_wpts, avg_lpts, lt20, gte20, total_games
      ) VALUES (?,?,?,?,?,?,?,?,?)
    `;
    for (const r0 of rows) {
      const r = [
        ...r0,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ].slice(0, 9);
      const scenario = norm(r[0]);
      if (!scenario) continue;
      await conn.execute(sql, r.map(norm));
    }
  }

  // t3: A36:H40
  await conn.execute("DELETE FROM adv_stats_t3");
  {
    const rowsRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "ADV STATS!A36:H40",
      valueRenderOption: "FORMATTED_VALUE",
    });
    const rows = (rowsRes.data.values ?? []) as string[][];
    const sql = `
      INSERT INTO adv_stats_t3 (
        scenario, republic, cis, rebels, empire,
        resistance, first_order, scum
      ) VALUES (?,?,?,?,?,?,?,?)
    `;
    for (const r0 of rows) {
      const r = [
        ...r0,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ].slice(0, 8);
      const scenario = norm(r[0]);
      if (!scenario) continue;
      await conn.execute(sql, r.map(norm));
    }
  }

  // t4: A43:H49
  await conn.execute("DELETE FROM adv_stats_t4");
  {
    const rowsRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "ADV STATS!A43:H49",
      valueRenderOption: "FORMATTED_VALUE",
    });
    const rows = (rowsRes.data.values ?? []) as string[][];
    const sql = `
      INSERT INTO adv_stats_t4 (
        faction_vs, republic, cis, rebels, empire,
        resistance, first_order, scum
      ) VALUES (?,?,?,?,?,?,?,?)
    `;
    for (const r0 of rows) {
      const r = [
        ...r0,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ].slice(0, 8);
      const factionVs = norm(r[0]);
      if (!factionVs) continue;
      await conn.execute(sql, r.map(norm));
    }
  }

  // t5: J36:P42
  await conn.execute("DELETE FROM adv_stats_t5");
  {
    const rowsRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "ADV STATS!J36:P42",
      valueRenderOption: "FORMATTED_VALUE",
    });
    const rows = (rowsRes.data.values ?? []) as string[][];
    const sql = `
      INSERT INTO adv_stats_t5 (
        faction, wins, losses, win_pct,
        avg_draft, expected_win_pct, perf_plus_minus
      ) VALUES (?,?,?,?,?,?,?)
    `;
    for (const r0 of rows) {
      const r = [
        ...r0,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ].slice(0, 7);
      const faction = norm(r[0]);
      if (!faction) continue;
      await conn.execute(sql, r.map(norm));
    }
  }
}

/* ---------------- all_time_stats ---------------- */

export async function syncAllTimeStats(
  sheets: SheetsClient,
  statsSheetId: string,
  conn: mysql.Connection
) {
  const rowsRes = await sheets.spreadsheets.values.get({
    spreadsheetId: statsSheetId,
    range: "ALL TIME STATS!A2:U500",
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = (rowsRes.data.values ?? []) as string[][];

  await conn.execute("DELETE FROM all_time_stats");

  const sql = `
    INSERT INTO all_time_stats (
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
      extra,
      s1,
      s2,
      s3,
      s4,
      s5,
      s6,
      s7,
      s8,
      championships
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `;

  for (const r0 of rows) {
    const r = [
      ...r0,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ].slice(0, 21);

    const [
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
      extra,
      s1,
      s2,
      s3,
      s4,
      s5,
      s6,
      s7,
      s8,
      championships,
    ] = r.map(norm);

    if (!ncxid && !first_name && !last_name) continue;

    await conn.execute(sql, [
      ncxid,
      first_name,
      last_name,
      discord,
      wins,
      losses,
      points,
      plms,
      games,
      toDecimalOrNone(win_pct),
      toDecimalOrNone(ppg),
      extra,
      s1,
      s2,
      s3,
      s4,
      s5,
      s6,
      s7,
      s8,
      toIntOrNone(championships),
    ]);
  }
}

/* ---------------- team_schedule ---------------- */

export async function syncTeamSchedule(
  sheets: SheetsClient,
  spreadsheetId: string,
  conn: mysql.Connection
) {
  const rowsRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "SCHEDULE!A2:D121",
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = (rowsRes.data.values ?? []) as string[][];

  await conn.execute("DELETE FROM team_schedule");

  const sql = `
    INSERT INTO team_schedule (
      week_label, away_team, home_team
    ) VALUES (?,?,?)
  `;

  for (const r0 of rows) {
    const r = [...r0, "", "", "", ""].slice(0, 4);
    const weekRaw = norm(r[0]);
    const away = norm(r[1]);
    const home = norm(r[3]);
    if (!weekRaw || (!away && !home)) continue;

    const weekLabel = normalizeWeekLabel(weekRaw);
    await conn.execute(sql, [weekLabel, away, home]);
  }
}

/* ---------------- overall_standings ---------------- */

export async function syncOverallStandings(
  sheets: SheetsClient,
  spreadsheetId: string,
  conn: mysql.Connection
) {
  const rowsRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "OVERALL RECORD!A2:F25",
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = (rowsRes.data.values ?? []) as string[][];

  await conn.execute("DELETE FROM overall_standings");

  const sql = `
    INSERT INTO overall_standings (
      team, \`rank\`, wins, losses, game_wins, points
    ) VALUES (?,?,?,?,?,?)
  `;

  for (const r0 of rows) {
    const r = [...r0, "", "", "", "", "", ""].slice(0, 6);
    const rankStr = norm(r[0]);
    const team = norm(r[1]);
    if (!rankStr || !team) continue;

    const rank = parseInt(rankStr, 10);
    const wins = toIntOrZero(r[2]);
    const losses = toIntOrZero(r[3]);
    const gameWins = toIntOrZero(r[4]);
    const points = toIntOrZero(r[5]);

    await conn.execute(sql, [team, rank, wins, losses, gameWins, points]);
  }
}

/* ---------------- lists ---------------- */

export async function syncLists(
  sheets: SheetsClient,
  spreadsheetId: string,
  conn: mysql.Connection
) {
  const rowsRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Lists!A2:D",
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = (rowsRes.data.values ?? []) as string[][];

  await conn.execute("DELETE FROM lists");

  const sql = `
    INSERT INTO lists (
      week_label, game, away_list, home_list
    ) VALUES (?,?,?,?)
  `;

  for (const r0 of rows) {
    const r = [...r0, "", "", "", ""].slice(0, 4);
    const weekRaw = norm(r[0]);
    const game = norm(r[1]);
    const awayList = norm(r[2]) || null;
    const homeList = norm(r[3]) || null;

    if (!weekRaw || !game) continue;

    const weekLabel = normalizeWeekLabel(weekRaw);
    await conn.execute(sql, [weekLabel, game, awayList, homeList]);
  }
}
