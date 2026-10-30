import { NextResponse } from 'next/server';
import { getEnrichedShipments } from '@/lib/db';
import { resolveLocationCoordinates } from '@/lib/geo/location-resolver';
import type { EnrichedShipment } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rawEnriched = getEnrichedShipments();

    // Attach resolved coordinates for map
    const fullyResolved: EnrichedShipment[] = rawEnriched.map((item) => {
      const originLoc = item.shipment.origin
        ? resolveLocationCoordinates(item.shipment.origin)
        : undefined;

      const currentLoc = item.tracking?.currentLocation
        ? resolveLocationCoordinates(item.tracking.currentLocation)
        : (item.shipment.origin ? originLoc : undefined);

      const destLoc = item.shipment.destination
        ? resolveLocationCoordinates(item.shipment.destination)
        : undefined;

      return {
        ...item,
        originLocation: originLoc,
        currentLocation: currentLoc,
        destinationLocation: destLoc,
      };
    });

    return NextResponse.json({
      success: true,
      shipments: fullyResolved,
      count: fullyResolved.length,
      retrievedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to fetch enriched shipments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve enriched shipments' },
      { status: 500 }
    );
  }
}
