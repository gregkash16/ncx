import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const appVersion = req.nextUrl.searchParams.get('v');
  const demoVersion = process.env.VERSION || '';
  const demoOn = process.env.DEMO_MODE === 'true'
    && !!appVersion
    && appVersion === demoVersion;

  return NextResponse.json({ demoMode: demoOn });
}
