import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function POST(req: Request) {
  const { endpoint } = await req.json().catch(() => ({}));
  if (endpoint) {
    await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;
  }
  return NextResponse.json({ ok: true });
}
