import { NextRequest, NextResponse } from 'next/server';
import { createDockBooking, listDockBookings } from '@/lib/db';
import { dockBookingCreateSchema } from '@/lib/validation';
import type { DockBooking } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const bookings = listDockBookings();
    return NextResponse.json({ success: true, bookings });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Failed to load bookings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = dockBookingCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message || 'Validation failed' },
      { status: 400 }
    );
  }

  // Generate server-issued confirmation ID
  const confNum = Math.floor(100000 + Math.random() * 900000);
  const confirmationId = `WH-CONF-${parsed.data.dockId.replace(' ', '')}-${confNum}`;
  const now = new Date().toISOString();

  const newBooking: DockBooking = {
    id: crypto.randomUUID(),
    shipmentId: parsed.data.shipmentId,
    trackingNumber: parsed.data.trackingNumber,
    carrierName: parsed.data.carrierName,
    dockId: parsed.data.dockId,
    slotTime: parsed.data.slotTime,
    status: 'CONFIRMED',
    confirmationId,
    originalBookingId: parsed.data.originalBookingId,
    notes: parsed.data.notes,
    createdAt: now,
    updatedAt: now,
  };

  createDockBooking(newBooking);

  return NextResponse.json({ success: true, booking: newBooking });
}
