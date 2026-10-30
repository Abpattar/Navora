import { NextResponse } from 'next/server';
import { listShipments } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  let databaseHealthy = false;
  try {
    listShipments();
    databaseHealthy = true;
  } catch {
    databaseHealthy = false;
  }

  return NextResponse.json({
    ok: true,
    service: 'freightcommand',
    tinyfishConfigured: Boolean(process.env.TINYFISH_API_KEY),
    databaseHealthy,
    appBaseUrlConfigured: Boolean(process.env.APP_BASE_URL),
    appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',
    checkedAt: new Date().toISOString(),
    note: 'Key presence and database connectivity are checked. Autonomous agent runs execute through strict 2-worker queue.',
  }, { headers: { 'Cache-Control': 'no-store' } });
}
