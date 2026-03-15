/**
 * Mobile auth helper for Bearer token validation
 */

import jwt from "jsonwebtoken";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

export interface MobileJWTPayload {
  discordId: string;
  ncxid: string | null;
  iat: number;
  exp: number;
}

/**
 * Extract caller identity from either Bearer token or NextAuth session
 * Returns both discordId and ncxid (ncxid only present if from Bearer token)
 */
export async function getCallerIdentity(
  req: Request
): Promise<{
  discordId: string | null;
  ncxid: string | null;
  source: "bearer" | "session" | null;
}> {
  // 1. Try Authorization: Bearer <jwt>
  const header = req.headers.get("Authorization");
  if (header?.startsWith("Bearer ")) {
    try {
      const token = header.slice(7);
      const payload = jwt.verify(
        token,
        process.env.MOBILE_JWT_SECRET!
      ) as MobileJWTPayload;
      return {
        discordId: payload.discordId,
        ncxid: payload.ncxid,
        source: "bearer",
      };
    } catch (e) {
      // Fall through to session-based auth
    }
  }

  // 2. Fall back to NextAuth cookie session
  const session = await getServerSession(authOptions);
  if (session?.user) {
    const discordId = (session.user as any).discordId ?? null;
    const ncxid = (session.user as any).ncxid ?? null;
    return { discordId, ncxid, source: session ? "session" : null };
  }

  return { discordId: null, ncxid: null, source: null };
}

/**
 * Create a 30-day JWT for mobile auth
 */
export function createMobileJWT(
  discordId: string,
  ncxid: string | null
): string {
  const payload: MobileJWTPayload = {
    discordId,
    ncxid,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
  };

  return jwt.sign(payload, process.env.MOBILE_JWT_SECRET!);
}

/**
 * Verify and optionally refresh a mobile JWT
 * Returns new token if within 7 days of expiry
 */
export function refreshMobileJWTIfNeeded(token: string): string | null {
  try {
    const payload = jwt.verify(
      token,
      process.env.MOBILE_JWT_SECRET!
    ) as MobileJWTPayload;

    const now = Math.floor(Date.now() / 1000);
    const daysUntilExpiry = (payload.exp - now) / (24 * 60 * 60);

    // Refresh if within 7 days of expiry
    if (daysUntilExpiry < 7) {
      return createMobileJWT(payload.discordId, payload.ncxid);
    }

    return null;
  } catch {
    return null;
  }
}
