'use client';

type Props = {
  team: string;
  side?: 'left' | 'right';
  sizeEm?: number; // optional, default 1.2em
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
export default function TeamLogo({ team, side = 'left', sizeEm = 1.2 }: Props) {
  if (!team) return null;
  const src = `/logos/${slugifyTeam(team)}.png`;

  // Use a plain <img> so we can hide on error without needing domain config.
  // (Server components strip handlers; this is a client component.)
  const marginClass = side === 'left' ? 'mr-2' : 'ml-2';

  return (
    <img
      src={src}
      alt={`${team} logo`}
      className={`inline-block align-middle object-contain ${marginClass}`}
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
