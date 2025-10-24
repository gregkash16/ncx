// src/app/api/matchups/route.ts
import { NextResponse } from 'next/server';
import { getMobileMatchupsData } from '../../m/matchups/data';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // ✅ force Node runtime

export async function GET() {
  try {
    const payload = await getMobileMatchupsData();
    return NextResponse.json(payload, { status: 200 });
  } catch (err: any) {
    console.error('GET /api/matchups failed:', err);
    return NextResponse.json(
      {
        error: 'Failed to load matchups',
        details: String(err?.message ?? err),
        // small hint to speed up debugging
        hint: 'Check env vars & service account key newlines; see server logs above for the real stack.',
      },
      { status: 500 }
    );
  }
}
