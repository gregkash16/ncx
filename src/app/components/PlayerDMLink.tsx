"use client";

type Props = {
  name: string;
  discordId?: string | null; // if missing, we render plain text
  className?: string;
  titleSuffix?: string;      // tooltip text, e.g. "Open in Discord app"
};

function isValidSnowflake(id: string | null | undefined): id is string {
  return !!id && /^\d{5,}$/.test(id);
}

export default function PlayerDMLink({
  name,
  discordId,
  className,
  titleSuffix = "Open in Discord app",
}: Props) {
  // If we don't have a valid snowflake, just show text
  if (!isValidSnowflake(discordId)) {
    return <span className={className}>{name}</span>;
  }

  // App deep link to the user's profile
  const appHref = `discord://-/users/${discordId}`;

  return (
    <a
      href={appHref}
      target="_self"              // let the OS route to the app
      rel="noreferrer"
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
