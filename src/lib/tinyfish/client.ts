import type { CarrierConfig, LookupStatus, ShipmentMilestone, ShipmentResult } from '@/lib/types';
import { isSafeExternalUrl } from '@/lib/carriers';
import { updateAgentRun } from '@/lib/db';
import { agentOrchestrator, OrchestratorEvent } from '@/lib/orchestrator';
import { COMPREHENSIVE_OUTPUT_SCHEMA, verifyAndNormalizeExtraction } from '@/lib/tinyfish/validation';

export class TinyFishLookupError extends Error {
  code: 'API_KEY_MISSING' | 'UPSTREAM_FAILED' | 'NO_USABLE_RESULT' | 'TIMEOUT' | 'SECURITY_BLOCKED';
  constructor(message: string, code: TinyFishLookupError['code']) {
    super(message);
    this.name = 'TinyFishLookupError';
    this.code = code;
  }
}

type UnknownRecord = Record<string, unknown>;

// Backward compatibility export
export const TRACKING_OUTPUT_SCHEMA = COMPREHENSIVE_OUTPUT_SCHEMA;

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
 * Executes a TinyFish READ tracking agent governed by the global Agent Orchestrator
 * (strict 2-run instance concurrency ceiling).
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

  return agentOrchestrator.schedule<ShipmentResult>({
    agentType: 'TRACKING',
    targetShipmentId: options.shipmentId,
    targetReference: options.trackingNumber,
    timeoutMs: options.timeoutMs || 90000,
    onEvent: (evt: OrchestratorEvent) => {
      options.onEvent?.({
        type: evt.type as AgentSSEEvent['type'],
        data: evt.data,
      });
    },
    execute: async (signal, emitEvent) => {
      const goal = [
        `You are inspecting the official public shipment-tracking portal for ${options.carrier.name}.`,
        `Search for this tracking reference: ${options.trackingNumber}.`,
        'Only inspect information available through authorized public website navigation.',
        'Do not bypass CAPTCHA, authentication, account requirements, or anti-bot defenses. If a restriction appears, report it immediately in restriction_type.',
        'Extract only information explicitly displayed on the official carrier page. Do not infer or invent missing dates.',
        'Return a structured object matching the output schema with complete milestones, ports, departure/arrival timestamps, and vessel/voyage details if visible.',
        'lookup_outcome must be one of: success, not_found, needs_login, blocked, unsupported, error.',
        'Use "Unavailable" for any missing text field.',
        `The official tracking portal is ${targetTrackingUrl}.`,
      ].join('\n');

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
            output_schema: COMPREHENSIVE_OUTPUT_SCHEMA,
          }),
          signal,
        });

        if (!sseResponse.ok) {
          const errText = await sseResponse.text();
          throw new Error(`TinyFish SSE endpoint returned HTTP ${sseResponse.status}: ${errText.slice(0, 200)}`);
        }

        if (!sseResponse.body) {
          throw new Error('TinyFish response body is null');
        }

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

                emitEvent(eventType as any, eventData);

                if (eventType === 'STREAMING_URL') {
                  streamingUrl = typeof eventData.streaming_url === 'string' ? eventData.streaming_url : undefined;
                } else if (eventType === 'PROGRESS') {
                  stepsCount++;
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
        const message = error instanceof Error ? error.message : 'Agent stream aborted';
        const isTimeout = signal.aborted;

        if (isTimeout) {
          throw new TinyFishLookupError('Live carrier lookup timed out. Please try again.', 'TIMEOUT');
        }
        throw new TinyFishLookupError(`TinyFish execution error: ${message}`, 'UPSTREAM_FAILED');
      }

      if (terminalError) {
        throw new TinyFishLookupError(terminalError, 'UPSTREAM_FAILED');
      }

      if (!completePayload) {
        throw new TinyFishLookupError('TinyFish stream terminated without a completion event.', 'NO_USABLE_RESULT');
      }

      const extracted = extractPayload(completePayload);
      if (!extracted) {
        throw new TinyFishLookupError('Could not parse structured shipment payload from completed run.', 'NO_USABLE_RESULT');
      }

      // Verification & Normalization Layer
      const sourceUrl = options.carrier.trackingUrl;
      const verification = verifyAndNormalizeExtraction(extracted, options.trackingNumber, sourceUrl);
      const normalized = verification.normalizedData;

      const lookupStatus: LookupStatus =
        verification.outcome === 'COMPLETE' || verification.outcome === 'PARTIAL'
          ? 'success'
          : verification.outcome === 'BLOCKED'
          ? 'blocked'
          : verification.outcome === 'NOT_FOUND'
          ? 'not_found'
          : 'error';

      const result: ShipmentResult = {
        id: crypto.randomUUID(),
        carrier: options.carrier.id,
        carrierName: options.carrier.name,
        trackingNumber: options.trackingNumber,
        lookupStatus,
        status: (normalized.status as string) || null,
        latestEvent: (normalized.status as string) || null,
        location: (normalized.currentLocation as string) || null,
        eventDate: (normalized.estimatedArrival as string) || null,
        estimatedArrival: (normalized.estimatedArrival as string) || null,
        origin: (normalized.origin as string) || null,
        destination: (normalized.destination as string) || null,
        lastFreeDate: (normalized.lastFreeDate as string) || null,
        milestones: (normalized.milestones as ShipmentMilestone[]) || [],
        sourceUrl,
        retrievedAt: new Date().toISOString(),
        warnings: [...verification.warnings],
      };

      if (!result.status && result.milestones.length > 0) {
        result.status = result.milestones[0].description;
        result.latestEvent = result.milestones[0].description;
      }

      if (verification.errors.length > 0) {
        result.errorMessage = verification.errors.join('; ');
      }

      emitEvent('COMPLETE', {
        result,
        verification,
        stepsCount,
        streamingUrl,
      });

      return result;
    },
  });
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
