import { TinyFish } from '@tiny-fish/sdk';
import type { CarrierConfig, LookupStatus, ShipmentMilestone, ShipmentResult } from '@/lib/types';

export class TinyFishLookupError extends Error {
  code: 'API_KEY_MISSING' | 'UPSTREAM_FAILED' | 'NO_USABLE_RESULT' | 'TIMEOUT';
  constructor(message: string, code: TinyFishLookupError['code']) {
    super(message);
    this.name = 'TinyFishLookupError';
    this.code = code;
  }
}

type UnknownRecord = Record<string, unknown>;

const outputSchema = {
  type: 'object',
  properties: {
    lookup_outcome: { type: 'string' },
    status: { type: 'string' },
    latest_event: { type: 'string' },
    location: { type: 'string' },
    event_date: { type: 'string' },
    estimated_arrival: { type: 'string' },
    origin: { type: 'string' },
    destination: { type: 'string' },
    last_free_date: { type: 'string' },
    milestones: { type: 'array', items: { type: 'string' } },
    source_url: { type: 'string' },
    notes: { type: 'string' },
  },
  required: [
    'lookup_outcome', 'status', 'latest_event', 'location', 'event_date',
    'estimated_arrival', 'origin', 'destination', 'last_free_date', 'milestones',
    'source_url', 'notes',
  ],
};

function asRecord(value: unknown): UnknownRecord | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as UnknownRecord;
  if (typeof value === 'string') {
    const trimmed = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as UnknownRecord;
    } catch {
      const match = trimmed.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const parsed: unknown = JSON.parse(match[0]);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as UnknownRecord;
        } catch { /* response does not contain parseable JSON */ }
      }
    }
  }
  return null;
}

function extractPayload(response: UnknownRecord): UnknownRecord | null {
  const candidates = [response.result, response.output, response.data, response.response];
  for (const candidate of candidates) {
    const record = asRecord(candidate);
    if (record) {
      // Some versions wrap the structured result one more level deep.
      const nested = asRecord(record.result) ?? asRecord(record.output) ?? asRecord(record.data);
      return nested ?? record;
    }
  }
  return asRecord(response);
}

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || /^(unavailable|unknown|not available|not found|n\/a|null|none|not provided)$/i.test(text)) return null;
  return text;
}

function cleanMilestones(value: unknown): ShipmentMilestone[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 25).map((item) => {
    if (typeof item === 'string') return { description: item.trim(), location: null, eventDate: null };
    const record = asRecord(item);
    return {
      description: cleanString(record?.description ?? record?.event) ?? 'Shipment event',
      location: cleanString(record?.location),
      eventDate: cleanString(record?.event_date ?? record?.eventDate ?? record?.date),
    };
  }).filter((item) => item.description.length > 0);
}

function normalizeOutcome(value: unknown, fields: { status: string | null; latestEvent: string | null; notes: string | null }): LookupStatus {
  const text = typeof value === 'string' ? value.toLowerCase() : '';
  const message = `${text} ${fields.notes ?? ''}`.toLowerCase();
  if (message.includes('needs_login') || message.includes('login required') || message.includes('sign in required') || message.includes('requires login')) return 'needs_login';
  if (message.includes('blocked') || message.includes('captcha') || message.includes('access denied') || message.includes('bot protection')) return 'blocked';
  if (message.includes('unsupported')) return 'unsupported';
  if (message.includes('not_found') || message.includes('not found') || message.includes('no matching shipment') || message.includes('no result')) return 'not_found';
  if (text.includes('error') || text.includes('failed')) return 'error';
  if (fields.status || fields.latestEvent) return 'success';
  return 'error';
}

function isPastDate(value: string | null): boolean {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now() - 24 * 60 * 60 * 1000;
}

function buildWarnings(status: string | null, eta: string | null, outcome: LookupStatus, notes: string | null): string[] {
  const warnings: string[] = [];
  if (outcome === 'blocked') warnings.push('The carrier page restricted the lookup. No workaround was attempted.');
  if (outcome === 'needs_login') warnings.push('Some information requires an authorized carrier account.');
  if (outcome === 'not_found') warnings.push('The carrier page did not return a matching shipment. Check the reference and carrier.');
  if (status && /delay|exception|rolled|missed connection|disruption|held/i.test(status)) warnings.push('The carrier status appears to report a delay or exception; verify the source details.');
  if (isPastDate(eta) && !/delivered|completed/i.test(status ?? '')) warnings.push('The estimated arrival appears to be in the past and delivery is not confirmed in the extracted status. Verify with the carrier.');
  if (!eta) warnings.push('No estimated arrival date was retrieved.');
  if (notes && outcome === 'success') warnings.push(notes);
  return [...new Set(warnings)];
}

export async function lookupShipmentWithTinyFish(input: {
  carrier: CarrierConfig;
  trackingNumber: string;
}): Promise<ShipmentResult> {
  const apiKey = process.env.TINYFISH_API_KEY;
  if (!apiKey) throw new TinyFishLookupError('TinyFish is not configured. Add TINYFISH_API_KEY to .env.local and restart the dev server.', 'API_KEY_MISSING');

  const client = new TinyFish({ apiKey });
  const goal = [
    `You are checking the official public shipment-tracking page for ${input.carrier.name}.`,
    `Search for this user-provided tracking reference exactly: ${input.trackingNumber}.`,
    'Only inspect information available through normal authorized public website use. Do not bypass CAPTCHA, access controls, account requirements, or anti-bot restrictions. If a restriction appears, stop and report it.',
    'Extract only information explicitly shown by the carrier page. Do not infer missing milestones or dates.',
    'Return a structured object matching the output schema.',
    'lookup_outcome must be one of: success, not_found, needs_login, blocked, unsupported, error.',
    'Use the exact string "Unavailable" for any unavailable text field. milestones should be an array of brief event descriptions, and may be empty.',
    'Include status, latest event, event location, event date, estimated arrival, origin, destination, and last free date only if the page actually provides them.',
    `The official tracking page is ${input.carrier.trackingUrl}. The page itself is the source of record.`,
  ].join('\n');

  let response: UnknownRecord;
  try {
    response = await client.agent.run({
      url: input.carrier.trackingUrl,
      goal,
      output_schema: outputSchema,
    }) as unknown as UnknownRecord;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TinyFish request failed.';
    if (/timeout|timed out|abort/i.test(message)) throw new TinyFishLookupError('The live lookup timed out. Try again or choose another carrier.', 'TIMEOUT');
    throw new TinyFishLookupError(`TinyFish could not complete the lookup: ${message.slice(0, 240)}`, 'UPSTREAM_FAILED');
  }

  const runStatus = String(response.status ?? '').toUpperCase();
  if (['FAILED', 'ERROR', 'CANCELLED', 'CANCELED', 'EXPIRED'].includes(runStatus)) {
    const message = asRecord(response.error)?.message;
    throw new TinyFishLookupError(typeof message === 'string' ? message : 'TinyFish reported that the browser task did not complete.', 'UPSTREAM_FAILED');
  }

  const data = extractPayload(response);
  if (!data) throw new TinyFishLookupError('TinyFish finished, but the response could not be parsed as structured shipment data.', 'NO_USABLE_RESULT');

  const status = cleanString(data.status);
  const latestEvent = cleanString(data.latest_event ?? data.latestEvent);
  const location = cleanString(data.location);
  const eta = cleanString(data.estimated_arrival ?? data.estimatedArrival);
  const notes = cleanString(data.notes);
  const lookupStatus = normalizeOutcome(data.lookup_outcome ?? data.lookupStatus, { status, latestEvent, notes });
  const suppliedSource = cleanString(data.source_url ?? data.sourceUrl);
  let sourceUrl = input.carrier.trackingUrl;
  if (suppliedSource) {
    try {
      const candidate = new URL(suppliedSource);
      const official = new URL(input.carrier.trackingUrl);
      // Do not surface an arbitrary URL supplied by an agent as a trusted carrier source.
      if (candidate.protocol === 'https:' && (candidate.hostname === official.hostname || candidate.hostname.endsWith(`.${official.hostname}`))) sourceUrl = candidate.toString();
    } catch { /* keep configured official tracking URL */ }
  }
  const result: ShipmentResult = {
    id: crypto.randomUUID(),
    carrier: input.carrier.id,
    carrierName: input.carrier.name,
    trackingNumber: input.trackingNumber,
    lookupStatus,
    status,
    latestEvent,
    location,
    eventDate: cleanString(data.event_date ?? data.eventDate),
    estimatedArrival: eta,
    origin: cleanString(data.origin),
    destination: cleanString(data.destination),
    lastFreeDate: cleanString(data.last_free_date ?? data.lastFreeDate),
    milestones: cleanMilestones(data.milestones),
    sourceUrl,
    retrievedAt: new Date().toISOString(),
    warnings: buildWarnings(status, eta, lookupStatus, notes),
  };

  if (lookupStatus === 'error' && !status && !latestEvent) {
    result.errorMessage = notes ?? 'The tracking result was inconclusive. Check the carrier website directly.';
  }
  return result;
}
