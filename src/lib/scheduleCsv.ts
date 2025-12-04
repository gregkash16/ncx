// src/lib/scheduleCsv.ts

const RAW_SCHEDULE_CSV_URL = process.env.NCX_SCHEDULE_CSV_URL;
if (!RAW_SCHEDULE_CSV_URL) {
  throw new Error("NCX_SCHEDULE_CSV_URL is not set in env");
}
const SCHEDULE_CSV_URL: string = RAW_SCHEDULE_CSV_URL;

// Very simple CSV parser
function parseCsv(text: string): string[][] {
  return text
    .trim()
    .split("\n")
    .map((line) => line.split(","));
}

export async function getScheduleCsvRows(): Promise<string[][]> {
  const res = await fetch(SCHEDULE_CSV_URL, {
    next: { revalidate: 30 }, // <-- 2 minutes
  });

  if (!res.ok) {
    throw new Error(
      `Failed to fetch SCHEDULE CSV: ${res.status} ${res.statusText}`
    );
  }

  const text = await res.text();
  return parseCsv(text);
}
