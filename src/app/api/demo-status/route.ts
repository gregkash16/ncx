import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    demoMode: process.env.DEMO_MODE === 'true',
    appleVersion: process.env.APPLE_VERSION ?? null,
  });
}
