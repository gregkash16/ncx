'use client';

type Props = {
  team: string;
  side?: 'left' | 'right';
  sizeEm?: number; // optional, default 1.2em
  className?: string; // 👈 NEW: allow extra styling (fixes TS error)
};

/** Turns "Crimson Squadron!" -> "crimson-squadron" */
function slugifyTeam(name: string) {
  return String(name)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/** Renders a team logo from /public/logos/<slug>.png and hides itself if missing */
export default function TeamLogo({
  team,
  side = 'left',
  sizeEm = 1.2,
  className = '',
}: Props) {
  if (!team) return null;
  const src = `/logos/${slugifyTeam(team)}.png`;

  // Margin based on side
  const marginClass = side === 'left' ? 'mr-2' : 'ml-2';

  return (
    <img
      src={src}
      alt={`${team} logo`}
      className={`inline-block align-middle object-contain ${marginClass} ${className}`}
      style={{ height: `${sizeEm}em`, width: 'auto' }}
      onError={(e) => {
        // Hide the image if it 404s (no layout shift)
        (e.currentTarget as HTMLImageElement).style.display = 'none';
      }}
      loading="eager"
      decoding="async"
    />
  );
}
