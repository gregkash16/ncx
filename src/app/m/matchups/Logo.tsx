'use client';
import Image from 'next/image';
import { useState } from 'react';

type LogoProps = {
  team: string;
  size?: number;
  className?: string;
  altPrefix?: string; // 👈 added to match MatchCard
};

function teamSlug(name: string) {
  return (name || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function Logo({ team, size = 32, className = '', altPrefix = '' }: LogoProps) {
  const [src, setSrc] = useState(`/logos/${teamSlug(team)}.webp`);

  return (
    <Image
      src={src}
      alt={`${altPrefix}${team || 'Team logo'}`}
      width={size}
      height={size}
      unoptimized
      className={`object-contain rounded-md border border-zinc-700 bg-zinc-800 ${className}`}
      onError={() => setSrc('/logos/default.png')}
    />
  );
}
