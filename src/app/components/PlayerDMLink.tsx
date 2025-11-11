"use client";

type Props = {
  name: string;
  discordId?: string | null; // if missing, we render plain text
  className?: string;
  titleSuffix?: string;      // tooltip text, e.g. "Open DM"
};

function isAndroid() {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

function appHref(discordId: string) {
  // Desktop/Mac/iOS can usually handle the custom scheme directly.
  // Android prefers an intent with a web fallback.
  const https = `https://discord.com/users/${discordId}`;
  if (isAndroid()) {
    // Opens the Discord app if present; otherwise falls back to browser URL
    return `intent://-/users/${discordId}#Intent;scheme=discord;package=com.discord;S.browser_fallback_url=${encodeURIComponent(
      https
    )};end`;
  }
  return `discord://-/users/${discordId}`;
}

export default function PlayerDMLink({
  name,
  discordId,
  className,
  titleSuffix = "Open DM",
}: Props) {
  // If we don't have a valid snowflake, just show text
  if (!discordId || !/^\d{5,}$/.test(discordId)) {
    return <span className={className}>{name}</span>;
  }

  const httpsHref = `https://discord.com/users/${discordId}`;
  const deepHref = appHref(discordId);

  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // For non-Android, we manually try the deep link then fallback to https
    if (!isAndroid()) {
      e.preventDefault();
      const start = Date.now();
      // Attempt to open the app
      window.location.href = deepHref;

      // If nothing handled it within ~1s, fallback to https
      setTimeout(() => {
        // Heuristic: if the page is still in foreground after 1s, assume it failed
        if (!document.hidden && Date.now() - start > 900) {
          window.open(httpsHref, "_blank", "noopener,noreferrer");
        }
      }, 1000);
    }
    // On Android, let the intent:// navigate normally (browser handles fallback)
  };

  return (
    <a
      href={deepHref}
      onClick={onClick}
      target={isAndroid() ? "_self" : "_blank"}
      rel="noopener noreferrer"
      className={
        className
          ? `${className} hover:underline inline-flex items-center gap-1`
          : "inline-flex items-center gap-1 hover:underline"
      }
      title={`${name} — ${titleSuffix}`}
    >
      <span>{name}</span>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
        <path d="M14 3h7v7h-2V6.41l-9.3 9.3-1.4-1.42L17.59 5H14V3z" />
      </svg>
    </a>
  );
}
