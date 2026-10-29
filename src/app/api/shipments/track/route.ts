import { NextRequest, NextResponse } from 'next/server';
import { getCarrier } from '@/lib/carriers';
import { lookupShipmentWithTinyFish, TinyFishLookupError } from '@/lib/tinyfish/client';
import { trackRequestSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, code: 'INVALID_JSON', error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const parsed = trackRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({
      success: false,
      code: 'VALIDATION_ERROR',
      error: parsed.error.issues[0]?.message ?? 'Please check the carrier and tracking reference.',
    }, { status: 400 });
  }

  const carrier = getCarrier(parsed.data.carrier);
  if (!carrier) {
    return NextResponse.json({ success: false, code: 'UNSUPPORTED_CARRIER', error: 'Choose a supported carrier.' }, { status: 400 });
  }

  try {
    const result = await lookupShipmentWithTinyFish({ carrier, trackingNumber: parsed.data.trackingNumber });
    return NextResponse.json({ success: result.lookupStatus === 'success', result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof TinyFishLookupError) {
      const status = error.code === 'API_KEY_MISSING' ? 503 : error.code === 'TIMEOUT' ? 504 : 502;
      return NextResponse.json({ success: false, code: error.code, error: error.message }, { status, headers: { 'Cache-Control': 'no-store' } });
    }
    console.error('Shipment lookup failed.', error instanceof Error ? error.message : 'Unknown failure');
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', error: 'The lookup failed unexpectedly. Try again or open the official carrier website.' }, { status: 500 });
  }
}
