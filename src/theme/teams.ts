// Central team color map + helpers.
// Used for per-team theme overrides (primary color) and thumbnails/accents.

export const TEAM_COLOR_MAP: Record<string, string> = {
  DEGENERATES: "#16a34a",
  FIREBIRDS: "#ea580c",
  FOXES: "#a855f7",
  GAMBLERS: "#d4af37", // gold
  HAVOC: "#7b1f2b", // maroon
  "TRASH PANDAS": "#FFFFFF",
  "HOTSHOTS": "#4a6d8c", // steel blue
  "JAGGED AXE": "#b5543e", // rust/copper
  KDB: "#14b8a6",
  "KING'S GAMBIT": "#9b111e", // ruby red
  MEATBAGS: "#dc2626",
  "MEGA MILK UNION": "#a8d4e8", // baby blue
  MISFITS: "#ea580c",
  "NEBULA BORN": "#e040a0", // hot pink/magenta
  "NERF HERDERS": "#1a6b3c", // forest green
  "ORDER 66": "#1c3d6e", // navy
  "OUTER RIM HEROES": "#2563eb",
  PILLAGERS: "#5b2d8b", // purple
  "PUDDLE JUMPERS": "#6b8c42", // olive green
  SANDBLASTERS: "#c8902a", // golden amber
  "RAVE CRAB CHAMPIONS": "#cc2244", // red/magenta
  STARKILLERS: "#d97706",
  "VOODOO KREWE": "#1e2d5a", // dark navy
  WOLFPACK: "#ec4899",
};

export function getTeamPrimaryHex(teamName?: string | null): string | null {
  if (!teamName) return null;
  const key = teamName.trim().toUpperCase();
  return TEAM_COLOR_MAP[key] ?? null;
}
