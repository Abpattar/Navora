import { NextRequest, NextResponse } from 'next/server';
import { executeShipmentWorkflow } from '@/lib/workflow/shipment-workflow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: { shipmentId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON request' }, { status: 400 });
  }

  if (!body.shipmentId) {
    return NextResponse.json({ success: false, error: 'shipmentId is required' }, { status: 400 });
  }

  try {
    const result = await executeShipmentWorkflow(body.shipmentId);
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Workflow execution failed';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
