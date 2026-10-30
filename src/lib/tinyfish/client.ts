import type { CarrierConfig, LookupStatus, ShipmentMilestone, ShipmentResult, ShipmentStatus } from '@/lib/types';
import { isSafeExternalUrl } from '@/lib/carriers';
import { appendAgentEvent, createAgentRun, updateAgentRun } from '@/lib/db';

export class TinyFishLookupError extends Error {
  code: 'API_KEY_MISSING' | 'UPSTREAM_FAILED' | 'NO_USABLE_RESULT' | 'TIMEOUT' | 'SECURITY_BLOCKED';
  constructor(message: string, code: TinyFishLookupError['code']) {
    super(message);
    this.name = 'TinyFishLookupError';
    this.code = code;
  }
}

type UnknownRecord = Record<string, unknown>;

export const TRACKING_OUTPUT_SCHEMA = {
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

// Backward compatibility export
export const COMPREHENSIVE_OUTPUT_SCHEMA = TRACKING_OUTPUT_SCHEMA;

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
        } catch { /* malformed */ }
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
  if (message.includes('needs_login') || message.includes('login required') || message.includes('sign in required')) return 'needs_login';
  if (message.includes('blocked') || message.includes('captcha') || message.includes('access denied') || message.includes('bot protection')) return 'blocked';
  if (message.includes('unsupported')) return 'unsupported';
  if (message.includes('not_found') || message.includes('not found') || message.includes('no matching shipment')) return 'not_found';
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
  if (outcome === 'blocked') warnings.push('The carrier page restricted automated access. No workaround was attempted.');
  if (outcome === 'needs_login') warnings.push('Some information requires an authorized carrier account.');
  if (outcome === 'not_found') warnings.push('The carrier page did not return a matching shipment. Check the reference.');
  if (status && /delay|exception|rolled|missed connection|disruption|held/i.test(status)) warnings.push('Carrier reported exception or transit delay.');
  if (isPastDate(eta) && !/delivered|completed/i.test(status ?? '')) warnings.push('Estimated arrival is in the past without confirmed delivery.');
  if (!eta) warnings.push('No estimated arrival date was retrieved.');
  if (notes && outcome === 'success') warnings.push(notes);
  return [...new Set(warnings)];
}

export interface AgentSSEEvent {
  type: 'STARTED' | 'STREAMING_URL' | 'PROGRESS' | 'HEARTBEAT' | 'COMPLETE' | 'FAILED' | 'LOG';
  data: UnknownRecord;
}

export interface RunAgentSSEOptions {
  carrier: CarrierConfig;
  trackingNumber: string;
  shipmentId?: string;
  onEvent?: (event: AgentSSEEvent) => void;
  timeoutMs?: number;
}

/**
 * Executes a TinyFish web agent using the official fast streaming SSE endpoint:
 * POST https://agent.tinyfish.ai/v1/automation/run-sse
 */
export async function runTrackingAgentSSE(options: RunAgentSSEOptions): Promise<ShipmentResult> {
  const apiKey = process.env.TINYFISH_API_KEY;
  if (!apiKey) {
    throw new TinyFishLookupError(
      'TinyFish is not configured. Add TINYFISH_API_KEY to .env.local and restart the dev server.',
      'API_KEY_MISSING'
    );
  }

  // Interpolate tracking reference if carrier template specifies {ID}, {TRACKING_ID}, or {POD_NO}
  const targetTrackingUrl = options.carrier.trackingUrl
    .replace(/\{(ID|TRACKING_ID|POD_NO)\}/gi, encodeURIComponent(options.trackingNumber));

  // Security: Domain allowlist and SSRF protection
  const securityCheck = isSafeExternalUrl(targetTrackingUrl, options.carrier.allowedDomains);
  if (!securityCheck.safe) {
    throw new TinyFishLookupError(
      `Navigation blocked for security: ${securityCheck.reason}`,
      'SECURITY_BLOCKED'
    );
  }

  const runId = `run-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const startTime = new Date().toISOString();

  // Create persistent agent run record
  createAgentRun({
    id: crypto.randomUUID(),
    runId,
    agentType: 'TRACKING',
    targetShipmentId: options.shipmentId,
    targetReference: options.trackingNumber,
    status: 'RUNNING',
    startTime,
    stepsCount: 0,
  });

  const goal = [
    `You are inspecting the official public shipment-tracking portal for ${options.carrier.name}.`,
    `Search for this tracking reference: ${options.trackingNumber}.`,
    'Only inspect information available through authorized public website navigation.',
    'Do not bypass CAPTCHA, authentication, account requirements, or anti-bot defenses. If a restriction appears, report it immediately.',
    'Extract only information explicitly displayed on the official carrier page. Do not infer or invent missing dates.',
    'Return a structured object matching the output schema.',
    'lookup_outcome must be one of: success, not_found, needs_login, blocked, unsupported, error.',
    'Use the exact string "Unavailable" for any missing text field.',
    `The official tracking portal is ${targetTrackingUrl}.`,
  ].join('\n');

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || 60000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let streamingUrl: string | undefined;
  let completePayload: UnknownRecord | null = null;
  let stepsCount = 0;
  let terminalError: string | null = null;

  try {
    const sseResponse = await fetch('https://agent.tinyfish.ai/v1/automation/run-sse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({
        url: targetTrackingUrl,
        goal,
        browser_profile: 'stealth',
        output_schema: TRACKING_OUTPUT_SCHEMA,
      }),
      signal: controller.signal,
    });

    if (!sseResponse.ok) {
      const errText = await sseResponse.text();
      throw new Error(`TinyFish SSE endpoint returned HTTP ${sseResponse.status}: ${errText.slice(0, 200)}`);
    }

    if (!sseResponse.body) {
      throw new Error('TinyFish response body is null');
    }

    // Process chunk-buffered SSE Stream
    const reader = sseResponse.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;

        if (trimmed.startsWith('data:')) {
          const jsonStr = trimmed.slice(5).trim();
          try {
            const eventData = JSON.parse(jsonStr) as UnknownRecord;
            const eventType = String(eventData.type || 'PROGRESS').toUpperCase();

            // Record Agent Event in DB
            appendAgentEvent({
              id: crypto.randomUUID(),
              runId,
              type: eventType as any,
              timestamp: new Date().toISOString(),
              message: String(eventData.purpose || eventData.message || eventType),
              payload: eventData,
            });

            // Dispatch callback to live subscribers (e.g. Live Agent Inspector)
            options.onEvent?.({
              type: eventType as any,
              data: eventData,
            });

            if (eventType === 'STREAMING_URL') {
              streamingUrl = typeof eventData.streaming_url === 'string' ? eventData.streaming_url : undefined;
              updateAgentRun(runId, { streamingUrl });
            } else if (eventType === 'PROGRESS') {
              stepsCount++;
              updateAgentRun(runId, { stepsCount });
            } else if (eventType === 'COMPLETE') {
              completePayload = eventData;
            } else if (eventType === 'FAILED') {
              terminalError = String(asRecord(eventData.error)?.message || 'Agent task reported failure');
            }
          } catch {
            // Ignore malformed individual SSE lines
          }
        }
      }
    }
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    const message = error instanceof Error ? error.message : 'Agent stream aborted';
    const isTimeout = /abort|timeout|timed out/i.test(message) || controller.signal.aborted;

    updateAgentRun(runId, {
      status: 'FAILED',
      endTime: new Date().toISOString(),
      error: message,
    });

    if (isTimeout) {
      throw new TinyFishLookupError('Live carrier lookup timed out. Please try again.', 'TIMEOUT');
    }
    throw new TinyFishLookupError(`TinyFish execution error: ${message}`, 'UPSTREAM_FAILED');
  } finally {
    clearTimeout(timeoutId);
  }

  const endTime = new Date().toISOString();

  if (terminalError) {
    updateAgentRun(runId, {
      status: 'FAILED',
      endTime,
      error: terminalError,
    });
    throw new TinyFishLookupError(terminalError, 'UPSTREAM_FAILED');
  }

  if (!completePayload) {
    updateAgentRun(runId, {
      status: 'FAILED',
      endTime,
      error: 'Stream closed without emitting a COMPLETE event',
    });
    throw new TinyFishLookupError('TinyFish stream terminated without a completion event.', 'NO_USABLE_RESULT');
  }

  const extracted = extractPayload(completePayload);
  if (!extracted) {
    updateAgentRun(runId, {
      status: 'FAILED',
      endTime,
      error: 'Completion event did not contain usable structured data',
    });
    throw new TinyFishLookupError('Could not parse structured shipment payload from completed run.', 'NO_USABLE_RESULT');
  }

  updateAgentRun(runId, {
    status: 'COMPLETED',
    endTime,
    extractedOutput: extracted,
    stepsCount,
  });

  const status = cleanString(extracted.status);
  const latestEvent = cleanString(extracted.latest_event ?? extracted.latestEvent);
  const location = cleanString(extracted.location);
  const eta = cleanString(extracted.estimated_arrival ?? extracted.estimatedArrival);
  const notes = cleanString(extracted.notes);
  const lookupStatus = normalizeOutcome(extracted.lookup_outcome ?? extracted.lookupStatus, { status, latestEvent, notes });

  const suppliedSource = cleanString(extracted.source_url ?? extracted.sourceUrl);
  let sourceUrl = targetTrackingUrl;
  if (suppliedSource) {
    try {
      const candidate = new URL(suppliedSource);
      const official = new URL(targetTrackingUrl);
      if (candidate.protocol === 'https:' && (candidate.hostname === official.hostname || candidate.hostname.endsWith(`.${official.hostname}`))) {
        sourceUrl = candidate.toString();
      }
    } catch {
      // keep official
    }
  }

  const result: ShipmentResult = {
    id: crypto.randomUUID(),
    carrier: options.carrier.id,
    carrierName: options.carrier.name,
    trackingNumber: options.trackingNumber,
    lookupStatus,
    status,
    latestEvent,
    location,
    eventDate: cleanString(extracted.event_date ?? extracted.eventDate),
    estimatedArrival: eta,
    origin: cleanString(extracted.origin),
    destination: cleanString(extracted.destination),
    lastFreeDate: cleanString(extracted.last_free_date ?? extracted.lastFreeDate),
    milestones: cleanMilestones(extracted.milestones),
    sourceUrl,
    retrievedAt: new Date().toISOString(),
    warnings: buildWarnings(status, eta, lookupStatus, notes),
  };

  if (lookupStatus === 'error' && !status && !latestEvent) {
    result.errorMessage = notes ?? 'The tracking result was inconclusive. Check the carrier portal directly.';
  }

  return result;
}

/**
 * Top-level shipment lookup function with backward compatibility
 */
export async function lookupShipmentWithTinyFish(input: {
  carrier: CarrierConfig;
  trackingNumber: string;
  shipmentId?: string;
}): Promise<ShipmentResult> {
  return runTrackingAgentSSE(input);
}
