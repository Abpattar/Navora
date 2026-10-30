import { NextRequest, NextResponse } from 'next/server';
import { getCarrier } from '@/lib/carriers';
import { lookupShipmentWithTinyFish, TinyFishLookupError } from '@/lib/tinyfish/client';
import { trackRequestSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const maxDuration = 60;

const batchSchema = trackRequestSchema.array().min(1).max(5);

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ success: false, error: 'Request body must be valid JSON.' }, { status: 400 });
  }
  const rawItems = (body && typeof body === 'object' && 'items' in body) ? (body as { items?: unknown }).items : undefined;
  const parsed = batchSchema.safeParse(rawItems);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Provide between 1 and 5 valid shipment references.' }, { status: 400 });
  }
  if (!process.env.TINYFISH_API_KEY) {
    return NextResponse.json({ success: false, code: 'API_KEY_MISSING', error: 'TinyFish is not configured. Add TINYFISH_API_KEY to .env.local.' }, { status: 503 });
  }

  const items = parsed.data;
  // Limit concurrency to two agent runs so batch requests don't launch five jobs at once.
  const results: Array<{ index: number; success: boolean; result?: unknown; error?: string }> = [];
  let nextIndex = 0;
  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      const item = items[index];
      const carrier = getCarrier(item.carrier);
      if (!carrier) {
        results.push({ index, success: false, error: 'Unsupported carrier.' });
        continue;
      }
      try {
        const result = await lookupShipmentWithTinyFish({ carrier, trackingNumber: item.trackingNumber });
        results.push({ index, success: result.lookupStatus === 'success', result });
      } catch (error) {
        results.push({ index, success: false, error: error instanceof TinyFishLookupError ? error.message : 'Lookup failed.' });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(2, items.length) }, () => worker()));
  results.sort((a, b) => a.index - b.index);
  return NextResponse.json({ success: results.every((item) => item.success), results }, { headers: { 'Cache-Control': 'no-store' } });
}
