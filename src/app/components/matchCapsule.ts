import type { MatchRow, IndRow } from "@/lib/googleSheets";

type ListMeta = {
  awayCount?: number;
  homeCount?: number;
  awayAverageInit?: number;
  homeAverageInit?: number;
};

function num(v: unknown): number {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

function winnerFromScore(away: number, home: number): "away" | "home" | "tie" {
  if (away > home) return "away";
  if (home > away) return "home";
  return "tie";
}

export type MatchCapsule = {
  title: string;
  lines: string[];
};

export function buildMatchCapsule(opts: {
  row: MatchRow;
  awaySeason?: IndRow;
  homeSeason?: IndRow;
  list?: ListMeta | null;
}): MatchCapsule {
  const { row, awaySeason, homeSeason, list } = opts;

  const awayPts = num(row.awayPts);
  const homePts = num(row.homePts);
  const awayPLMS = num(row.awayPLMS);
  const homePLMS = num(row.homePLMS);

  const scenario = (row.scenario || "").trim();
  const isComplete = Boolean(scenario);

  // If the game isn't complete, we still return something predictable
  if (!isComplete) {
    return {
      title: "Game Capsule",
      lines: [
        "Capsule unavailable — this game has not been reported yet.",
      ],
    };
  }

  const awayName = row.awayName || "Away";
  const homeName = row.homeName || "Home";

  const winner = winnerFromScore(awayPts, homePts);
  const margin = Math.abs(awayPts - homePts);

  const lines: string[] = [];

  // --- Result line ------------------------------------------------------
  if (winner === "tie") {
    lines.push(`Finished tied ${awayPts}–${homePts} on ${scenario}.`);
  } else if (winner === "away") {
    lines.push(`${awayName} won ${awayPts}–${homePts} on ${scenario}.`);
  } else {
    lines.push(`${homeName} won ${homePts}–${awayPts} on ${scenario}.`);
  }

  // --- Margin texture ---------------------------------------------------
  if (margin >= 12) {
    lines.push("Large margin — this one swung decisively.");
  } else if (margin <= 4) {
    lines.push("Close finish — a small swing changes the result.");
  }

  // --- PL/MS context ----------------------------------------------------
  if (awayPLMS !== 0 || homePLMS !== 0) {
    const delta = awayPLMS - homePLMS;
    if (Math.abs(delta) >= 8) {
      lines.push(
        `PL/MS gap was significant (${awayPLMS.toFixed(1)} vs ${homePLMS.toFixed(
          1
        )}).`
      );
    } else {
      lines.push(
        `PL/MS was close (${awayPLMS.toFixed(1)} vs ${homePLMS.toFixed(1)}).`
      );
    }
  }

  // --- List texture (optional) -----------------------------------------
  if (list?.awayCount != null && list?.homeCount != null) {
    if (list.awayCount === list.homeCount) {
      lines.push(`Both lists were at ${list.awayCount} ships.`);
    } else {
      lines.push(
        `Ship count split: ${awayName} (${list.awayCount}) vs ${homeName} (${list.homeCount}).`
      );
    }
  }

  if (
    list?.awayAverageInit != null &&
    list?.homeAverageInit != null
  ) {
    const d = list.awayAverageInit - list.homeAverageInit;
    if (Math.abs(d) >= 0.6) {
      lines.push(
        `Average pilot initiative leaned ${
          d > 0 ? "away" : "home"
        } (${list.awayAverageInit.toFixed(1)} vs ${list.homeAverageInit.toFixed(
          1
        )}).`
      );
    }
  }

  // --- Season context (optional, safe) ---------------------------------
  if (
    awaySeason?.wins &&
    awaySeason?.losses &&
    homeSeason?.wins &&
    homeSeason?.losses
  ) {
    lines.push(
      `Season records: ${awayName} ${awaySeason.wins}-${awaySeason.losses}, ${homeName} ${homeSeason.wins}-${homeSeason.losses}.`
    );
  }

  return {
    title: "Game Capsule",
    lines,
  };
}
