import { NextRequest, NextResponse } from 'next/server';
import { listDockBookings } from '@/lib/db';
import type { DockId } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DOCKS: DockId[] = ['Dock A', 'Dock B', 'Dock C'];
const STANDARD_SLOT_HOURS = [8, 10, 12, 14, 16, 18]; // 08:00, 10:00, 12:00, 14:00, 16:00, 18:00

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0];

  const targetDate = new Date(dateStr);
  if (Number.isNaN(targetDate.getTime())) {
    return NextResponse.json({ success: false, error: 'Invalid date parameter' }, { status: 400 });
  }

  const existingBookings = listDockBookings().filter((b) => b.status !== 'CANCELLED');

  const slots: Array<{
    dockId: DockId;
    slotTime: string;
    formattedTime: string;
    isAvailable: boolean;
    existingBooking?: {
      shipmentId: string;
      trackingNumber: string;
      confirmationId: string;
    };
  }> = [];

  for (const dockId of DOCKS) {
    for (const hour of STANDARD_SLOT_HOURS) {
      const slotDate = new Date(targetDate);
      slotDate.setHours(hour, 0, 0, 0);
      const slotIso = slotDate.toISOString();

      const bookingMatch = existingBookings.find(
        (b) => b.dockId === dockId && Math.abs(new Date(b.slotTime).getTime() - slotDate.getTime()) < 60 * 60 * 1000
      );

      slots.push({
        dockId,
        slotTime: slotIso,
        formattedTime: `${hour.toString().padStart(2, '0')}:00`,
        isAvailable: !bookingMatch,
        existingBooking: bookingMatch
          ? {
              shipmentId: bookingMatch.shipmentId,
              trackingNumber: bookingMatch.trackingNumber,
              confirmationId: bookingMatch.confirmationId,
            }
          : undefined,
      });
    }
  }

  return NextResponse.json({
    success: true,
    date: dateStr,
    slots,
    availableCount: slots.filter((s) => s.isAvailable).length,
    totalCount: slots.length,
  });
}
