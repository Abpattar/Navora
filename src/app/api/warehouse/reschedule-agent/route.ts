import { NextRequest } from 'next/server';
import { getShipment } from '@/lib/db';
import { evaluateRescheduleDecision } from '@/lib/logistics/reschedule-decision-engine';
import { runWarehouseRescheduleAgent } from '@/lib/tinyfish/warehouse-agent';
import type { DockId, SlotRecommendation } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  let body: {
    shipmentId?: string;
    recommendedDockId?: DockId;
    recommendedSlotTime?: string;
    reason?: string;
  };

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }

  const shipmentId = body.shipmentId;
  if (!shipmentId) {
    return new Response(JSON.stringify({ error: 'shipmentId is required' }), { status: 400 });
  }

  const shipment = getShipment(shipmentId);
  if (!shipment) {
    return new Response(JSON.stringify({ error: `Shipment "${shipmentId}" not found` }), { status: 404 });
  }

  // Derive recommendation or use provided override
  let recommendation: SlotRecommendation;
  if (body.recommendedDockId && body.recommendedSlotTime) {
    const originalDockId: DockId = (shipment.assignedDock as DockId) || 'Dock A';
    const originalSlotTime = shipment.assignedDockSlot || shipment.promisedEta || new Date().toISOString();
    recommendation = {
      dockId: body.recommendedDockId,
      slotTime: body.recommendedSlotTime,
      reason: body.reason || 'Operator-specified rescheduling recommendation',
      bufferHours: 4,
      arrivalEta: body.recommendedSlotTime,
      confidence: 'CONFIRMED',
      durationHours: 2,
      conflictDetected: false,
      shipmentId: shipment.id,
      trackingNumber: shipment.trackingNumber,
      originalDockId,
      originalSlotTime,
      recommendedDockId: body.recommendedDockId,
      recommendedSlotTime: body.recommendedSlotTime,
      delayMinutes: 0,
      reasoning: body.reason || 'Operator-specified rescheduling recommendation',
      alternativeSlots: [],
      demurrageRisk: 'NONE',
    };
  } else {
    recommendation = evaluateRescheduleDecision({ shipment });
  }

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  const sendEvent = async (data: Record<string, unknown>) => {
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    } catch {
      // client disconnected
    }
  };

  (async () => {
    try {
      await sendEvent({
        type: 'STARTED',
        message: `Dispatching Autonomous Warehouse Agent for shipment ${shipment.trackingNumber}`,
        recommendation,
        timestamp: new Date().toISOString(),
      });

      const result = await runWarehouseRescheduleAgent({
        shipment,
        recommendation,
        onEvent: async (evt) => {
          await sendEvent({
            type: evt.type,
            runId: evt.runId,
            message: String(evt.data.message || evt.type),
            payload: evt.data,
            timestamp: evt.timestamp,
          });
        },
      });

      await sendEvent({
        type: 'COMPLETE',
        message: `Warehouse rescheduling executed and verified. Confirmation: ${result.confirmationId}`,
        result,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Warehouse agent execution failed';
      await sendEvent({
        type: 'FAILED',
        message: msg,
        timestamp: new Date().toISOString(),
      });
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
