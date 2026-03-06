// /src/app/api/secret/conversation/route.ts
// In-memory store (resets on redeploy — swap for Vercel KV if you want persistence)

import { NextRequest, NextResponse } from "next/server";

interface Conversation {
  user: string;
  assistant: string;
  timestamp: number;
}

// Module-level store (persists across requests in same serverless instance)
let latest: Conversation | null = null;

export async function GET() {
  return NextResponse.json(latest || { user: "", assistant: "", timestamp: 0 });
}

export async function POST(req: NextRequest) {
  const { user, assistant } = await req.json();
  latest = { user, assistant, timestamp: Date.now() };
  return NextResponse.json({ ok: true });
}
