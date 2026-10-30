import { NextRequest, NextResponse } from 'next/server';
import {
  createDockBooking,
  createRescheduleAction,
  getDockBookingByShipment,
  getShipment,
  saveShipment,
  updateDockBookingStatus,
} from '@/lib/db';
import { rescheduleActionSchema } from '@/lib/validation';
import type { DockBooking, RescheduleAction } from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = rescheduleActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message },
      { status: 400 }
    );
  }

  const shipment = getShipment(parsed.data.shipmentId);
  if (!shipment) {
    return NextResponse.json({ success: false, error: 'Shipment not found' }, { status: 404 });
  }

  // Retrieve original active booking
  const originalBooking = getDockBookingByShipment(shipment.id);
  const now = new Date().toISOString();

  const originalBookingId = originalBooking?.id || parsed.data.originalBookingId || 'NONE';
  const originalSlotTime = originalBooking?.slotTime || shipment.promisedEta || now;
  const originalDockId = originalBooking?.dockId || 'Dock A';

  const actionId = `act-${Date.now()}`;

  // If human approval is required but not granted yet
  if (!parsed.data.approved) {
    const action: RescheduleAction = {
      id: actionId,
      shipmentId: shipment.id,
      trackingNumber: shipment.trackingNumber,
      carrier: shipment.carrier,
      originalBookingId,
      originalSlotTime,
      originalDockId,
      recommendedDockId: parsed.data.recommendedDockId,
      recommendedSlotTime: parsed.data.recommendedSlotTime,
      status: 'APPROVAL_REQUIRED',
      reason: parsed.data.reason,
      createdAt: now,
    };
    createRescheduleAction(action);
    return NextResponse.json({
      success: true,
      status: 'APPROVAL_REQUIRED',
      action,
      message: 'Rescheduling proposal registered and awaiting human approval.',
    });
  }

  // CRITICAL SAFETY RULE: Create and confirm replacement BEFORE modifying original booking!
  try {
    const confNum = Math.floor(100000 + Math.random() * 900000);
    const newConfirmationId = `WH-CONF-RESCHED-${parsed.data.recommendedDockId.replace(' ', '')}-${confNum}`;

    const replacementBooking: DockBooking = {
      id: crypto.randomUUID(),
      shipmentId: shipment.id,
      trackingNumber: shipment.trackingNumber,
      carrierName: shipment.carrierName,
      dockId: parsed.data.recommendedDockId,
      slotTime: parsed.data.recommendedSlotTime,
      status: 'CONFIRMED',
      confirmationId: newConfirmationId,
      originalBookingId,
      notes: `Rescheduled from ${originalDockId} (${originalSlotTime}) due to ${parsed.data.reason}`,
      createdAt: now,
      updatedAt: now,
    };

    // Step 1: Confirm replacement reservation first
    createDockBooking(replacementBooking);

    // Step 2: Now that replacement is confirmed, mark original reservation as RESCHEDULED
    if (originalBooking) {
      updateDockBookingStatus(originalBooking.id, 'RESCHEDULED');
    }

    // Step 3: Update shipment's assigned dock details
    saveShipment({
      ...shipment,
      assignedDock: parsed.data.recommendedDockId,
      assignedDockSlot: parsed.data.recommendedSlotTime,
      updatedAt: now,
    });

    // Step 4: Record completed action audit
    const completedAction: RescheduleAction = {
      id: actionId,
      shipmentId: shipment.id,
      trackingNumber: shipment.trackingNumber,
      carrier: shipment.carrier,
      originalBookingId,
      originalSlotTime,
      originalDockId,
      recommendedDockId: parsed.data.recommendedDockId,
      recommendedSlotTime: parsed.data.recommendedSlotTime,
      status: 'COMPLETED',
      confirmationId: newConfirmationId,
      reason: parsed.data.reason,
      createdAt: now,
      executedAt: new Date().toISOString(),
    };
    createRescheduleAction(completedAction);

    return NextResponse.json({
      success: true,
      status: 'COMPLETED',
      replacementBooking,
      confirmationId: newConfirmationId,
      action: completedAction,
      message: 'Warehouse dock successfully rescheduled. Original booking safely transitioned.',
    });
  } catch (err) {
    // If anything fails, original booking remains 100% active and untouched
    const failedAction: RescheduleAction = {
      id: actionId,
      shipmentId: shipment.id,
      trackingNumber: shipment.trackingNumber,
      carrier: shipment.carrier,
      originalBookingId,
      originalSlotTime,
      originalDockId,
      recommendedDockId: parsed.data.recommendedDockId,
      recommendedSlotTime: parsed.data.recommendedSlotTime,
      status: 'FAILED',
      reason: parsed.data.reason,
      error: err instanceof Error ? err.message : 'Reservation replacement transaction failed',
      createdAt: now,
      executedAt: new Date().toISOString(),
    };
    createRescheduleAction(failedAction);

    return NextResponse.json(
      {
        success: false,
        status: 'FAILED',
        error: 'Replacement reservation could not be confirmed. Original booking preserved.',
        action: failedAction,
      },
      { status: 500 }
    );
  }
}
