// src/app/components/PrevSeasonsPanel.tsx
import { fetchSeasonStats, type SeasonNumber, type StatsMode } from "@/lib/SeasonStats";
import PrevSeasonsPanelClient from "./PrevSeasonsPanelClient";

type Props = {
  season: SeasonNumber;
  mode: StatsMode;
};

export default async function PrevSeasonsPanel({ season, mode }: Props) {
  let result;
  let error: string | null = null;

  try {
    result = await fetchSeasonStats(season, mode);
  } catch (e) {
    console.error("fetchSeasonStats error:", e);
    error = "Failed to load season data. Please try again.";
    result = { columns: [], rows: [] };
  }

  return (
    <PrevSeasonsPanelClient
      season={season}
      mode={mode}
      columns={result.columns}
      rows={result.rows}
      error={error}
    />
  );
}
