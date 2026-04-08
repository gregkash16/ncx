/**
 * /api/advstats
 *
 * Returns all 5 advanced stats tables for native app consumption.
 */

import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    const [t1Rows] = await pool.query<any[]>(`SELECT * FROM S9.adv_stats_t1`);
    const [t2Rows] = await pool.query<any[]>(`SELECT * FROM S9.adv_stats_t2`);
    const [t3Rows] = await pool.query<any[]>(`SELECT * FROM S9.adv_stats_t3`);
    const [t4Rows] = await pool.query<any[]>(`SELECT * FROM S9.adv_stats_t4`);
    const [t5Rows] = await pool.query<any[]>(`SELECT * FROM S9.adv_stats_t5`);

    const norm = (v: any) => v != null ? String(v).trim() : '';

    const t1 = (t1Rows ?? []).map((r: any) => ({
      team: norm(r.team),
      totalGames: norm(r.total_games),
      avgWins: norm(r.avg_wins),
      avgLoss: norm(r.avg_loss),
      avgPoints: norm(r.avg_points),
      avgPlms: norm(r.avg_plms),
      avgGames: norm(r.avg_games),
      avgWinPct: norm(r.avg_win_pct),
      avgPpg: norm(r.avg_ppg),
      avgEfficiency: norm(r.avg_efficiency),
      avgWar: norm(r.avg_war),
      avgH2h: norm(r.avg_h2h),
      avgPotato: norm(r.avg_potato),
      avgSos: norm(r.avg_sos),
    }));

    const t2 = (t2Rows ?? []).map((r: any) => ({
      scenario: norm(r.scenario),
      avgHomePts: norm(r.avg_home_pts),
      avgAwayPts: norm(r.avg_away_pts),
      avgTotalPts: norm(r.avg_total_pts),
      avgWpts: norm(r.avg_wpts),
      avgLpts: norm(r.avg_lpts),
      lt20: norm(r.lt20),
      gte20: norm(r.gte20),
      totalGames: norm(r.total_games),
    }));

    const t3 = (t3Rows ?? []).map((r: any) => ({
      scenario: norm(r.scenario),
      republic: norm(r.republic),
      cis: norm(r.cis),
      rebels: norm(r.rebels),
      empire: norm(r.empire),
      resistance: norm(r.resistance),
      firstOrder: norm(r.first_order),
      scum: norm(r.scum),
    }));

    const FACTION_ORDER = ['Republic', 'CIS', 'Rebels', 'Empire', 'Resistance', 'First Order', 'Scum'];
    const factionIndex = (name: string) => {
      const i = FACTION_ORDER.findIndex(f => f.toLowerCase() === name.toLowerCase());
      return i === -1 ? 999 : i;
    };

    const t4 = (t4Rows ?? []).map((r: any) => ({
      factionVs: norm(r.faction_vs),
      republic: norm(r.republic),
      cis: norm(r.cis),
      rebels: norm(r.rebels),
      empire: norm(r.empire),
      resistance: norm(r.resistance),
      firstOrder: norm(r.first_order),
      scum: norm(r.scum),
    })).sort((a, b) => factionIndex(a.factionVs) - factionIndex(b.factionVs));

    const t5 = (t5Rows ?? []).map((r: any) => ({
      faction: norm(r.faction),
      wins: norm(r.wins),
      losses: norm(r.losses),
      winPct: norm(r.win_pct),
      avgDraft: norm(r.avg_draft),
      expectedWinPct: norm(r.expected_win_pct),
      perfPlusMinus: norm(r.perf_plus_minus),
    }));

    return NextResponse.json({ t1, t2, t3, t4, t5 });
  } catch (err: any) {
    console.error('GET /api/advstats error:', err);
    return NextResponse.json(
      { error: err.message ?? 'Failed to fetch advanced stats' },
      { status: 500 }
    );
  }
}
