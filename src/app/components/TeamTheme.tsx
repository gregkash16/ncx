import React from "react";
import { getTeamPrimaryHex } from "@/theme/teams";

/**
 * Optional per-team theme overrides:
 * - If `teamName` resolves to a known team color, we set CSS variables that the UI can use.
 * - If not, it renders children unchanged.
 *
 * Use this as a wrapper around pages/panels that should "pick up" team accents.
 */
function hexToRgbTriplet(hex: string): string | null {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return `${r} ${g} ${b}`;
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number) {
  h = ((h % 360) + 360) % 360;
  s = clamp01(s); l = clamp01(l);
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let rp = 0, gp = 0, bp = 0;
  if (h < 60) { rp = c; gp = x; bp = 0; }
  else if (h < 120) { rp = x; gp = c; bp = 0; }
  else if (h < 180) { rp = 0; gp = c; bp = x; }
  else if (h < 240) { rp = 0; gp = x; bp = c; }
  else if (h < 300) { rp = x; gp = 0; bp = c; }
  else { rp = c; gp = 0; bp = x; }

  const r = Math.round((rp + m) * 255);
  const g = Math.round((gp + m) * 255);
  const b = Math.round((bp + m) * 255);
  return { r, g, b };
}

function deriveSecondary(hex: string): string | null {
  const trip = hexToRgbTriplet(hex);
  if (!trip) return null;
  const [r, g, b] = trip.split(" ").map((n) => parseInt(n, 10));
  const { h, s, l } = rgbToHsl(r, g, b);

  // A simple “house style” secondary: hue shift + slightly lower saturation + a touch more lightness.
  const { r: r2, g: g2, b: b2 } = hslToRgb(h + 40, Math.max(0, s - 0.08), Math.min(1, l + 0.06));
  return `${r2} ${g2} ${b2}`;
}

export default function TeamTheme({
  teamName,
  children,
  className,
}: {
  teamName?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  const primaryHex = getTeamPrimaryHex(teamName);
  if (!primaryHex) return <div className={className}>{children}</div>;

  const primaryRgb = hexToRgbTriplet(primaryHex);
  const secondaryRgb = deriveSecondary(primaryHex);

  const styleVars: React.CSSProperties = {
    ...(primaryRgb ? { ["--team-primary-rgb" as any]: primaryRgb } : {}),
    ...(secondaryRgb ? { ["--team-secondary-rgb" as any]: secondaryRgb } : {}),
  };

  return (
    <div className={className} style={styleVars}>
      {children}
    </div>
  );
}
