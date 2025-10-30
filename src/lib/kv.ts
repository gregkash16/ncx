function getKvEnv() {
  const url = process.env.YTKV_REST_API_URL;
  const token = process.env.YTKV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error(
      `Missing Upstash REST envs: ${
        !url ? "YTKV_REST_API_URL " : ""
      }${!token ? "YTKV_REST_API_TOKEN" : ""}`
    );
  }
  return { url, token };
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const { url, token } = getKvEnv(); // ✅ only evaluated when called at runtime
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
    if (
      parsed &&
      typeof parsed === "object" &&
      "value" in parsed &&
      typeof (parsed as any).value === "string"
    ) {
      return JSON.parse((parsed as any).value) as T;
    }
    return parsed as T;
  } catch {
    return raw as unknown as T;
  }
}

export async function kvSet(key: string, value: unknown, ttlSec?: number) {
  const { url, token } = getKvEnv(); // ✅ lazy
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
