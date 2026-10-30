import { NextRequest, NextResponse } from 'next/server';
import { getAgentEvents, listAgentRuns } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shipmentId = searchParams.get('shipmentId');

  const allRuns = listAgentRuns(20);
  const trackingRun = allRuns.find(
    (r) => r.agentType === 'TRACKING' && (!shipmentId || r.targetShipmentId === shipmentId)
  ) || null;

  const warehouseRun = allRuns.find(
    (r) => r.agentType === 'WAREHOUSE' && (!shipmentId || r.targetShipmentId === shipmentId)
  ) || null;

  const trackingEvents = trackingRun ? getAgentEvents(trackingRun.runId) : [];
  const warehouseEvents = warehouseRun ? getAgentEvents(warehouseRun.runId) : [];

  return NextResponse.json({
    success: true,
    trackingRun,
    trackingEvents,
    warehouseRun,
    warehouseEvents,
  });
}
