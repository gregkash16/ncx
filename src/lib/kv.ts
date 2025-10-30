function pickEnv(names: string[]): string | null {
  for (const n of names) {
    const v = process.env[n];
    if (v) return v;
  }
  return null;
}

function getKvEnv() {
  const url =
    pickEnv([
      "YTKV_KV_REST_API_URL",     // <-- yours
      "YTKV_REST_API_URL",
      "KV_REST_API_URL",
      "UPSTASH_REDIS_REST_URL",
    ]);
  const token =
    pickEnv([
      "YTKV_KV_REST_API_TOKEN",   // <-- yours
      "YTKV_REST_API_TOKEN",
      "KV_REST_API_TOKEN",
      "UPSTASH_REDIS_REST_TOKEN",
      "YTKV_KV_REST_API_READ_ONLY_TOKEN", // last-resort fallback
    ]);
  if (!url || !token) {
    throw new Error(
      `Missing Upstash REST envs. Have URL=${!!url}, TOKEN=${!!token}.
Checked names: URL[YTKV_KV_REST_API_URL,YTKV_REST_API_URL,KV_REST_API_URL,UPSTASH_REDIS_REST_URL] TOKEN[YTKV_KV_REST_API_TOKEN,YTKV_REST_API_TOKEN,KV_REST_API_TOKEN,UPSTASH_REDIS_REST_TOKEN,YTKV_KV_REST_API_READ_ONLY_TOKEN]`
    );
  }
  return { url, token };
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const { url, token } = getKvEnv();
  const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const json = await res.json();
  const result = json?.result;

  let raw: string;
  if (typeof result === "string") {
    raw = result;
  } else if (result && typeof (result as any).value === "string") {
    raw = (result as any).value;
  } else {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "value" in parsed && typeof (parsed as any).value === "string") {
      return JSON.parse((parsed as any).value) as T;
    }
    return parsed as T;
  } catch {
    return raw as unknown as T;
  }
}

export async function kvSet(key: string, value: unknown, ttlSec?: number) {
  const { url, token } = getKvEnv();
  const body = { value: JSON.stringify(value), ...(ttlSec ? { ex: ttlSec } : {}) };
  const res = await fetch(`${url}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KV set failed: ${res.status} ${text}`);
  }
}
