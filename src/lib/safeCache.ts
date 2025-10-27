// src/lib/safeCache.ts
import { unstable_cache } from "next/cache";

/**
 * Wrap unstable_cache so the "cache function" is declared once and re-used.
 * Also supports returning STALE data if the fresh load fails.
 */
export function safeCache<T>(
  loader: () => Promise<T>,
  keyParts: (string | number | null | undefined)[],
  revalidateSeconds: number,
  opts?: { staleOnError?: boolean }
) {
  const cached = unstable_cache(loader, keyParts.map(String), {
    revalidate: revalidateSeconds,
  });

  return async () => {
    try {
      return await cached();
    } catch (err) {
      if (!opts?.staleOnError) throw err;

      // Try to return the last cached value by calling the same cached fn again.
      // If there truly is nothing cached yet, this will rethrow.
      try {
        return await cached();
      } catch {
        throw err;
      }
    }
  };
}
