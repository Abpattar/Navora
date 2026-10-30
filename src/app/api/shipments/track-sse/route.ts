import { NextRequest } from 'next/server';
import { getCarrier } from '@/lib/carriers';
import { runTrackingAgentSSE } from '@/lib/tinyfish/client';
import { trackRequestSchema } from '@/lib/validation';
import { saveTrackingObservation } from '@/lib/db';
import type { ShipmentStatus, ShipmentTracking } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const parsed = trackRequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.issues[0]?.message }), { status: 400 });
  }

  const carrier = getCarrier(parsed.data.carrier);
  if (!carrier) {
    return new Response(JSON.stringify({ error: 'Unsupported carrier' }), { status: 400 });
  }

  const shipmentId = (body as { shipmentId?: string })?.shipmentId || crypto.randomUUID();

  // Create streaming SSE response using TransformStream
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

  // Run in background while writing to stream
  (async () => {
    try {
      await sendEvent({
        type: 'STARTED',
        message: `Connecting to ${carrier.name} official portal (${carrier.trackingUrl})`,
        timestamp: new Date().toISOString(),
      });

      const result = await runTrackingAgentSSE({
        carrier,
        trackingNumber: parsed.data.trackingNumber,
        shipmentId,
        onEvent: async (evt) => {
          await sendEvent({
            type: evt.type,
            message: String(evt.data.purpose || evt.data.message || evt.type),
            streamingUrl: evt.data.streaming_url,
            payload: evt.data,
            timestamp: new Date().toISOString(),
          });
        },
      });

      // Map to DB observation
      const rawStatus = result.status || result.latestEvent || '';
      let currentStatus: ShipmentStatus = 'UNKNOWN';
      if (/delivered/i.test(rawStatus)) currentStatus = 'DELIVERED';
      else if (/customs/i.test(rawStatus)) currentStatus = 'CUSTOMS_HOLD';
      else if (/terminal|discharged|arrived/i.test(rawStatus)) currentStatus = 'ARRIVED_AT_TERMINAL';
      else if (/delayed|held|exception/i.test(rawStatus)) currentStatus = 'DELAYED';
      else if (result.lookupStatus === 'success') currentStatus = 'IN_TRANSIT';

      const trackingRecord: ShipmentTracking = {
        id: crypto.randomUUID(),
        shipmentId,
        trackingNumber: parsed.data.trackingNumber,
        carrier: carrier.id,
        carrierName: carrier.name,
        lookupStatus: result.lookupStatus,
        currentStatus,
        rawStatus: result.status,
        currentLocation: result.location,
        liveEta: result.estimatedArrival,
        isDelayed: currentStatus === 'DELAYED' || /delay|late/i.test(result.warnings.join(' ')),
        latestMilestone: result.latestEvent,
        lastFreeDate: result.lastFreeDate,
        eventDate: result.eventDate,
        sourceUrl: result.sourceUrl,
        retrievedAt: result.retrievedAt,
        milestones: result.milestones,
        warnings: result.warnings,
        errorMessage: result.errorMessage,
      };

      saveTrackingObservation(trackingRecord);

      await sendEvent({
        type: 'COMPLETE',
        message: `Successfully extracted verified milestone from ${carrier.name}`,
        result,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lookup failed';
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
