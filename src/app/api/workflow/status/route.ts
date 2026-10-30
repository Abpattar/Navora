import { NextRequest, NextResponse } from 'next/server';
import { getShipmentWorkflow, listShipmentWorkflows } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shipmentId = searchParams.get('shipmentId');

  try {
    if (shipmentId) {
      const workflow = getShipmentWorkflow(shipmentId);
      return NextResponse.json({ success: true, workflow: workflow || null });
    }

    const workflows = listShipmentWorkflows();
    return NextResponse.json({ success: true, workflows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to query workflow status';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
