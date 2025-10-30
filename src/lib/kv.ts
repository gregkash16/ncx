function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

const YTKV_URL = must("YTKV_REST_API_URL");
const YTKV_TOKEN = must("YTKV_REST_API_TOKEN");

export async function kvGet<T>(key: string): Promise<T | null> {
  const url = `${YTKV_URL}/get/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${YTKV_TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const json = await res.json();
  // Upstash REST can return:
  // 1) { result: "<stringified JSON>" }
  // 2) { result: { value: "<stringified JSON>", ...meta } }
  const result = json?.result;

  let raw: string;
    if (typeof result === "string") {
    raw = result;
    } else if (result && typeof result === "object" && typeof (result as any).value === "string") {
    raw = (result as any).value;
    } else {
    return null;
    }

  try {
    const parsed = JSON.parse(raw);
    // Some older writes might have double-wrapped { value: "<json>" }
    if (parsed && typeof parsed === "object" && "value" in parsed && typeof parsed.value === "string") {
      return JSON.parse((parsed as any).value) as T;
    }
    return parsed as T;
  } catch {
    // If it wasn't JSON, return as-is (typed)
    return raw as unknown as T;
  }
}

export async function kvSet(key: string, value: unknown, ttlSec?: number) {
  const url = `${YTKV_URL}/set/${encodeURIComponent(key)}`;
  const body = { value: JSON.stringify(value), ...(ttlSec ? { ex: ttlSec } : {}) };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${YTKV_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KV set failed: ${res.status} ${text}`);
  }
}

// optional
export async function kvDel(key: string) {
  const url = `${YTKV_URL}/del/${encodeURIComponent(key)}`;
  await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${YTKV_TOKEN}` } });
}
