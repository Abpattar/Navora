import { NextRequest, NextResponse } from 'next/server';
import {
  createDockBooking,
  createRescheduleAction,
  getDockBookingByShipment,
  getShipment,
  saveShipment,
  updateDockBookingStatus,
  saveShipmentWorkflow,
  getShipmentWorkflow,
} from '@/lib/db';
import type { DockBooking, DockId, RescheduleAction } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: {
    shipmentId?: string;
    replacementDockId?: DockId;
    replacementSlotTime?: string;
    reason?: string;
    originalBookingId?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON request' }, { status: 400 });
  }

  const { shipmentId, replacementDockId, replacementSlotTime, reason } = body;
  if (!shipmentId || !replacementDockId || !replacementSlotTime) {
    return NextResponse.json(
      { success: false, error: 'shipmentId, replacementDockId, and replacementSlotTime are required' },
      { status: 400 }
    );
  }

  const shipment = getShipment(shipmentId);
  if (!shipment) {
    return NextResponse.json({ success: false, error: `Shipment "${shipmentId}" not found` }, { status: 404 });
  }

  const originalBooking = body.originalBookingId
    ? getDockBookingByShipment(shipment.id)
    : getDockBookingByShipment(shipment.id);

  const now = new Date().toISOString();
  const randKey = Math.floor(100000 + Math.random() * 900000);
  const confirmationId = `WH-CONF-${replacementDockId.replace(/\s+/g, '')}-${randKey}`;

  // 1. Transaction Step 1: Create confirmed replacement booking FIRST
  const replacementBooking: DockBooking = {
    id: crypto.randomUUID(),
    shipmentId: shipment.id,
    trackingNumber: shipment.trackingNumber,
    carrierName: shipment.carrierName,
    dockId: replacementDockId,
    slotTime: replacementSlotTime,
    status: 'CONFIRMED',
    confirmationId,
    originalBookingId: originalBooking?.id,
    notes: reason || 'Autonomous dock reschedule mitigation',
    createdAt: now,
    updatedAt: now,
  };

  createDockBooking(replacementBooking);

  // 2. Transaction Step 2: Atomic Safety Failsafe
  // Only release/transition prior booking after new confirmation is safely committed
  if (originalBooking && originalBooking.id !== replacementBooking.id) {
    updateDockBookingStatus(originalBooking.id, 'RESCHEDULED');
  }

  // 3. Update shipment record
  saveShipment({
    ...shipment,
    assignedDock: replacementDockId,
    assignedDockSlot: replacementSlotTime,
    updatedAt: now,
  });

  // 4. Record audit reschedule action
  const action: RescheduleAction = {
    id: `act-resched-${Date.now()}`,
    shipmentId: shipment.id,
    trackingNumber: shipment.trackingNumber,
    carrier: shipment.carrier,
    originalBookingId: originalBooking?.id || 'NONE',
    originalSlotTime: originalBooking?.slotTime || shipment.promisedEta || now,
    originalDockId: (originalBooking?.dockId || shipment.assignedDock || 'Dock A') as DockId,
    recommendedDockId: replacementDockId,
    recommendedSlotTime: replacementSlotTime,
    status: 'COMPLETED',
    confirmationId,
    reason: reason || 'Autonomous slot optimization',
    createdAt: now,
    executedAt: now,
  };
  createRescheduleAction(action);

  // 5. Update shipment workflow state if present
  try {
    const existingWf = getShipmentWorkflow(shipment.id);
    if (existingWf) {
      saveShipmentWorkflow({
        ...existingWf,
        currentState: 'COMPLETED',
        status: 'COMPLETED',
        currentStep: 'VERIFY',
        confirmationId,
        updatedAt: now,
      });
    }
  } catch { /* ignore */ }

  return NextResponse.json({
    success: true,
    booking: replacementBooking,
    confirmationId,
    action,
  });
}
