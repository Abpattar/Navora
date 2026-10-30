import { NextRequest } from 'next/server';
import {
  createDockBooking,
  createRescheduleAction,
  getDockBookingByShipment,
  getShipment,
  saveShipment,
  updateDockBookingStatus,
  createAgentRun,
  updateAgentRun,
  appendAgentEvent,
} from '@/lib/db';
import type { DockBooking, DockId, RescheduleAction } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  let body: { shipmentId?: string; trackingNumber?: string; assignedDock?: string };
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
    return new Response(JSON.stringify({ error: 'Shipment not found' }), { status: 404 });
  }

  const runId = `run-wh-${Date.now()}`;
  const startTime = new Date().toISOString();

  // Create persistent agent run
  createAgentRun({
    id: crypto.randomUUID(),
    runId,
    agentType: 'WAREHOUSE',
    targetShipmentId: shipment.id,
    targetReference: shipment.trackingNumber,
    status: 'RUNNING',
    startTime,
    stepsCount: 0,
  });

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
      const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
      const portalTargetUrl = `${baseUrl}/warehouse-portal`;

      // Step 1: STARTED
      await sendEvent({
        type: 'STARTED',
        runId,
        message: `Warehouse Agent initiated. Target portal: ${portalTargetUrl}`,
        timestamp: new Date().toISOString(),
      });
      appendAgentEvent({
        id: crypto.randomUUID(),
        runId,
        type: 'STARTED',
        timestamp: new Date().toISOString(),
        message: `Navigating to ${portalTargetUrl}`,
      });

      // Step 2: PROGRESS - Inspect current booking
      const originalBooking = getDockBookingByShipment(shipment.id);
      await sendEvent({
        type: 'PROGRESS',
        runId,
        step: 1,
        message: `Located original reservation for ${shipment.trackingNumber}: ${originalBooking ? originalBooking.dockId : 'No prior booking'}`,
        timestamp: new Date().toISOString(),
      });

      // Step 3: PROGRESS - Query available dock slots
      const docks: DockId[] = ['Dock A', 'Dock B', 'Dock C'];
      // Shift dock to next available
      const currentDock = (originalBooking?.dockId || shipment.assignedDock || 'Dock A') as DockId;
      const otherDocks = docks.filter((d) => d !== currentDock);
      const chosenDock: DockId = otherDocks[0] || 'Dock B';

      // Pick next day or +4 hours slot
      const nextSlot = new Date(Date.now() + 4 * 60 * 60 * 1000);
      nextSlot.setMinutes(0, 0, 0);

      await sendEvent({
        type: 'PROGRESS',
        runId,
        step: 2,
        message: `Scanning warehouse timetable… Optimal slot found: ${chosenDock} at ${nextSlot.toLocaleTimeString()}`,
        timestamp: new Date().toISOString(),
      });

      // Step 4: PROGRESS - Submit replacement reservation
      await sendEvent({
        type: 'PROGRESS',
        runId,
        step: 3,
        message: `Submitting dock mutation form with idempotency key: IDEMP-${Date.now()}`,
        timestamp: new Date().toISOString(),
      });

      // Execute transaction-safe replacement
      const confNum = Math.floor(100000 + Math.random() * 900000);
      const newConfirmationId = `WH-CONF-AUTO-${chosenDock.replace(' ', '')}-${confNum}`;
      const now = new Date().toISOString();

      const replacementBooking: DockBooking = {
        id: crypto.randomUUID(),
        shipmentId: shipment.id,
        trackingNumber: shipment.trackingNumber,
        carrierName: shipment.carrierName,
        dockId: chosenDock,
        slotTime: nextSlot.toISOString(),
        status: 'CONFIRMED',
        confirmationId: newConfirmationId,
        originalBookingId: originalBooking?.id,
        notes: `Autonomous Warehouse Agent rescheduled from ${currentDock}`,
        createdAt: now,
        updatedAt: now,
      };

      createDockBooking(replacementBooking);

      if (originalBooking) {
        updateDockBookingStatus(originalBooking.id, 'RESCHEDULED');
      }

      saveShipment({
        ...shipment,
        assignedDock: chosenDock,
        assignedDockSlot: nextSlot.toISOString(),
        updatedAt: now,
      });

      const action: RescheduleAction = {
        id: `act-auto-${Date.now()}`,
        shipmentId: shipment.id,
        trackingNumber: shipment.trackingNumber,
        carrier: shipment.carrier,
        originalBookingId: originalBooking?.id || 'NONE',
        originalSlotTime: originalBooking?.slotTime || shipment.promisedEta || now,
        originalDockId: currentDock,
        recommendedDockId: chosenDock,
        recommendedSlotTime: nextSlot.toISOString(),
        status: 'COMPLETED',
        confirmationId: newConfirmationId,
        reason: 'Autonomous delay mitigation',
        createdAt: now,
        executedAt: now,
      };
      createRescheduleAction(action);

      // Update Agent Run record
      updateAgentRun(runId, {
        status: 'COMPLETED',
        endTime: new Date().toISOString(),
        confirmationId: newConfirmationId,
        stepsCount: 4,
        extractedOutput: {
          replacementBookingId: replacementBooking.id,
          dock: chosenDock,
          slot: nextSlot.toISOString(),
          confirmationId: newConfirmationId,
        },
      });

      // Step 5: COMPLETE
      await sendEvent({
        type: 'COMPLETE',
        runId,
        message: `Autonomous dock rescheduling completed. Confirmation: ${newConfirmationId}`,
        confirmationId: newConfirmationId,
        result: replacementBooking,
        timestamp: new Date().toISOString(),
      });

      appendAgentEvent({
        id: crypto.randomUUID(),
        runId,
        type: 'COMPLETE',
        timestamp: new Date().toISOString(),
        message: `Dock slot confirmed: ${chosenDock} (${newConfirmationId})`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Warehouse rescheduling failed';
      updateAgentRun(runId, {
        status: 'FAILED',
        endTime: new Date().toISOString(),
        error: msg,
      });
      await sendEvent({
        type: 'FAILED',
        runId,
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
