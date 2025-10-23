// src/app/components/players.types.ts
export type PlayerRow = {
  ncxid: string;
  first: string;
  last: string;
  discord: string;
  wins: string;
  losses: string;
  points: string;
  plms: string;
  games: string;
  winPct: string;
  ppg: string;
  seasons: (string | null)[]; // S1..S8 team names, null if empty
  championships: string;
};
