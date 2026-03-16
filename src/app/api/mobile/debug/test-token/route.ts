/**
 * DEBUG ONLY: Test token for development
 * Returns a JWT for testing as Christopher Patrick (NCX01)
 */

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-key";

export async function GET() {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { ok: false, reason: "DEBUG_DISABLED" },
      { status: 403 }
    );
  }

  try {
    const token = jwt.sign(
      {
        discordId: "debug123",
        name: "Christopher Patrick",
        ncxid: "NCX01",
        avatar: null,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return NextResponse.json({
      ok: true,
      token,
      user: {
        discordId: "debug123",
        name: "Christopher Patrick",
        ncxid: "NCX01",
        avatar: null,
      },
    });
  } catch (e) {
    console.error("[debug/test-token]", e);
    return NextResponse.json(
      { ok: false, reason: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
