import { NextRequest, NextResponse } from 'next/server';
import { createDockBooking, saveShipment } from '@/lib/db';
import { getCarrier } from '@/lib/carriers';
import { trackingQueue } from '@/lib/queue/tracking-queue';
import type { DockBooking, DockId, ManifestImportRow, Shipment } from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  let body: { rows?: ManifestImportRow[]; manifestId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const rows = body.rows || [];
  if (!rows.length) {
    return NextResponse.json({ success: false, error: 'No rows provided to commit' }, { status: 400 });
  }

  const validRows = rows.filter((r) => r.isValid && r.trackingNumber && r.carrier);
  if (!validRows.length) {
    return NextResponse.json({ success: false, error: 'No valid rows found to import' }, { status: 400 });
  }

  const manifestId = body.manifestId || `mnf-${Date.now()}`;
  const now = new Date().toISOString();
  const createdShipments: Shipment[] = [];
  const queueItems: Array<{ shipmentId: string; carrier: any; trackingNumber: string }> = [];

  for (const row of validRows) {
    const carrierConfig = getCarrier(row.carrier);
    const carrierName = carrierConfig ? carrierConfig.name : row.carrier;
    const shipmentId = crypto.randomUUID();

    const shipmentRecord: Shipment = {
      id: shipmentId,
      manifestId,
      shipmentId: row.shipmentId || `FC-${Math.floor(1000 + Math.random() * 9000)}`,
      trackingNumber: row.trackingNumber,
      carrier: row.carrier,
      carrierName,
      origin: row.origin || null,
      destination: row.destination || null,
      promisedEta: row.promisedEta || null,
      assignedDock: row.assignedDock || null,
      assignedDockSlot: row.promisedEta || null,
      createdAt: now,
      updatedAt: now,
    };

    saveShipment(shipmentRecord);
    createdShipments.push(shipmentRecord);

    // If an assigned dock was specified in spreadsheet, create initial confirmed dock booking
    if (row.assignedDock && ['Dock A', 'Dock B', 'Dock C'].includes(row.assignedDock)) {
      const confNum = Math.floor(100000 + Math.random() * 900000);
      const booking: DockBooking = {
        id: crypto.randomUUID(),
        shipmentId: shipmentRecord.id,
        trackingNumber: shipmentRecord.trackingNumber,
        carrierName: shipmentRecord.carrierName,
        dockId: row.assignedDock as DockId,
        slotTime: row.promisedEta || now,
        status: 'CONFIRMED',
        confirmationId: `WH-CONF-${row.assignedDock.replace(' ', '')}-${confNum}`,
        notes: 'Initial manifest allocation',
        createdAt: now,
        updatedAt: now,
      };
      createDockBooking(booking);
    }

    queueItems.push({
      shipmentId: shipmentRecord.id,
      carrier: row.carrier,
      trackingNumber: row.trackingNumber,
    });
  }

  // Enqueue in global tracking queue with strict 2-worker limit
  const enqueuedTasks = trackingQueue.enqueue(queueItems);

  return NextResponse.json({
    success: true,
    manifestId,
    importedCount: createdShipments.length,
    enqueuedCount: enqueuedTasks.length,
    shipments: createdShipments,
  });
}
