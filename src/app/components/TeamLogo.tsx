// src/app/components/TeamLogo.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

function norm(s: string) {
  // trim + normalize + remove diacritics + collapse whitespace
  return (s || '')
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ');
}

function slug(name: string) {
  const n = norm(name)
    .toLowerCase()
    .replace(/&/g, 'and')
    // keep letters/numbers/spaces/hyphens, drop punctuation
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '');
  return n;
}

const ASSET_VERSION = process.env.NEXT_PUBLIC_ASSET_VERSION || 'v1';

export default function TeamLogo({
  team,
  size = 28,
  className = '',
  altPrefix = '',
}: {
  team: string;
  size?: number;
  className?: string;
  altPrefix?: string;
}) {
  const slugged = useMemo(() => slug(team), [team]);
  const url = useMemo(
    () => (slugged ? `/logos/${slugged}.png?v=${ASSET_VERSION}` : '/logos/default.png'),
    [slugged]
  );

  const [src, setSrc] = useState(url);
  const [failed, setFailed] = useState(false);

  // update src whenever team changes
  useEffect(() => {
    setFailed(false);
    setSrc(url);
  }, [url]);

  // If image failed, show a text fallback (initials chip)
  if (failed) {
    const initials =
      norm(team)
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 3)
        .toUpperCase() || '—';

    return (
      <span
        title={`${altPrefix}${team || 'Team'}`}
        className={[
          'inline-flex items-center justify-center rounded-md border border-zinc-700 bg-zinc-800 text-[10px] font-bold text-zinc-200',
          className || '',
        ].join(' ')}
        style={{ width: size, height: size }}
      >
        {initials}
      </span>
    );
  }

  return (
    <img
      src={src} // absolute path from /public
      alt={`${altPrefix}${team || 'Team'}`}
      width={size}
      height={size}
      className={className}
      onError={() => {
        // Log once in dev to see exactly which URL failed
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.warn('[TeamLogo] 404 ->', src, 'for team:', team);
        }
        setFailed(true);
      }}
      decoding="async"
      loading="eager"
    />
  );
}
