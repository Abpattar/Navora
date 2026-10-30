import { NextResponse } from 'next/server';
import { trackingQueue } from '@/lib/queue/tracking-queue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const stats = trackingQueue.getStats();
  const tasks = trackingQueue.getTasks().slice(-20);
  return NextResponse.json({
    success: true,
    stats,
    tasks,
  });
}
