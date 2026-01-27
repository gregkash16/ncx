// Central team color map + helpers.
// Used for per-team theme overrides (primary color) and thumbnails/accents.

export const TEAM_COLOR_MAP: Record<string, string> = {
  BERSERKERS: "#8b5a2b",
  DEGENERATES: "#16a34a",
  FIREBIRDS: "#ea580c",
  FOXES: "#a855f7",
  GAMBLERS: "#d4af37", // gold
  HAVOC: "#eab308",
  "TRASH PANDAS": "#FFFFFF",
  "HOTSHOTS": "#facc99",
  "JAGGED AXE": "#f97316",
  KDB: "#14b8a6",
  "KING'S GAMBIT": "#9b111e", // ruby red
  MEATBAGS: "#dc2626",
  "MEGA MILK UNION": "#38bdf8",
  MISFITS: "#ea580c",
  "NERF HERDERS": "#16a34a",
  "ORDER 66": "#2563eb",
  "OUTER RIM HEROES": "#2563eb",
  PILLAGERS: "#4b1d6b", // deep purple
  "PUDDLE JUMPERS": "#22c55e",
  SANDBLASTERS: "#8b5a2b",
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
