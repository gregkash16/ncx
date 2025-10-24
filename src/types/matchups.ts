export type MatchRow = {
game: string;
awayId: string;
awayName: string;
awayTeam: string;
awayW: string;
awayL: string;
awayPts: string;
awayPLMS: string;
homeId: string;
homeName: string;
homeTeam: string;
homeW: string;
homeL: string;
homePts: string;
homePLMS: string;
scenario: string;
};


export type IndRow = {
ncxid: string;
wins: string;
losses: string;
winPct?: string;
sos?: string;
potato?: string;
};


export type ScheduleMap = Record<string, { day: string; slot: string }>;


'use client';