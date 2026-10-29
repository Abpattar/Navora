import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'global-freight-command-center',
    tinyfishConfigured: Boolean(process.env.TINYFISH_API_KEY),
    checkedAt: new Date().toISOString(),
    note: 'Key presence is checked only. A real agent run is required to verify upstream access.',
  }, { headers: { 'Cache-Control': 'no-store' } });
}
