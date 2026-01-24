// Central team color map + helpers.
// Used for per-team theme overrides (primary color) and thumbnails/accents.

export const TEAM_COLOR_MAP: Record<string, string> = {
  BERSERKERS: "#8b5a2b",
  DEGENERATES: "#16a34a",
  FIREBIRDS: "#ea580c",
  FOXES: "#a855f7",
  GAMBLERS: "#16a34a",
  HAVOC: "#eab308",
  HEADHUNTERS: "#020617",
  HOTSHOTS: "#facc99",
  "JAGGED AXE": "#f97316",
  KDB: "#14b8a6",
  MAWLERS: "#14b8a6",
  MEATBAGS: "#dc2626",
  "MEGA MILK UNION": "#38bdf8",
  MISFITS: "#ea580c",
  "MON CALA SC": "#5eead4",
  "NERF HERDERS": "#16a34a",
  "ORDER 66": "#2563eb",
  "OUTER RIM HEROES": "#2563eb",
  PUDDLEJUMPERS: "#22c55e",
  "PUDDLE JUMPERS": "#22c55e",
  PUNISHERS: "#ef4444",
  "RAVE CRAB CHAMPIONS": "#fb923c",
  STARKILLERS: "#d97706",
  "VOODOO KREWE": "#1d4ed8",
  WOLFPACK: "#ec4899",
};

export function getTeamPrimaryHex(teamName?: string | null): string | null {
  if (!teamName) return null;
  const key = teamName.trim().toUpperCase();
  return TEAM_COLOR_MAP[key] ?? null;
}
