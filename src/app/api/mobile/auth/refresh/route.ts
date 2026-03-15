/**
 * POST /api/mobile/auth/refresh
 * Refresh a non-expired JWT token
 *
 * Body: { token: string }
 * Returns: { token: string } (new token) or 204 No Content (no refresh needed)
 */

import { NextResponse } from "next/server";
import { refreshMobileJWTIfNeeded } from "@/lib/mobileAuth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid token" },
        { status: 400 }
      );
    }

    const newToken = refreshMobileJWTIfNeeded(token);

    if (newToken) {
      // Token was refreshed
      return NextResponse.json({ token: newToken });
    } else {
      // Token doesn't need refresh
      return new NextResponse(null, { status: 204 });
    }
  } catch (e) {
    console.error("[mobile/auth/refresh] POST error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
