// src/lib/weekCsv.ts

// Very simple CSV parser
function parseCsv(text: string): string[][] {
  return text
    .trim()
    .split("\n")
    .map((line) => line.split(","));
}

function getWeekCsvUrl(weekTab: string): string {
  // Expect things like "WEEK 1", "WEEK 2", etc (your normalizeWeekLabel output)
  const m = weekTab.match(/(\d+)/);
  const num = m ? Number(m[1]) : NaN;
  if (!Number.isFinite(num)) {
    throw new Error(`Cannot derive week number from label: "${weekTab}"`);
  }

  const envKey = `NCX_WEEK${num}_CSV_URL` as keyof NodeJS.ProcessEnv;
  const url = process.env[envKey];

  if (!url) {
    throw new Error(`Missing env var ${envKey} for week "${weekTab}"`);
  }

  return url;
}

export async function getWeekCsvRows(weekTab: string): Promise<string[][]> {
  const url = getWeekCsvUrl(weekTab);

  const res = await fetch(url, {
    next: { revalidate: 30 }, // weeks can update more often; tweak if you want
  });

  if (!res.ok) {
    throw new Error(
      `Failed to fetch CSV for ${weekTab}: ${res.status} ${res.statusText}`
    );
  }

  const text = await res.text();
  return parseCsv(text);
}
