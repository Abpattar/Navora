import type { ExtractionOutcome, ExtractionVerification, ShipmentMilestone } from '@/lib/types';
import { parseIsoOrDate } from '@/lib/logistics/eta-calculator';

export const COMPREHENSIVE_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    tracking_reference: { type: 'string' },
    lookup_outcome: {
      type: 'string',
      enum: ['success', 'not_found', 'needs_login', 'blocked', 'unsupported', 'error'],
    },
    current_status: { type: 'string' },
    origin: { type: 'string' },
    destination: { type: 'string' },
    current_location: { type: 'string' },
    estimated_departure: { type: 'string' },
    actual_departure: { type: 'string' },
    estimated_arrival: { type: 'string' },
    actual_arrival: { type: 'string' },
    vessel_or_flight: { type: 'string' },
    last_free_date: { type: 'string' },
    milestones: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          location: { type: 'string' },
          timestamp: { type: 'string' },
        },
        required: ['description'],
      },
    },
    restriction_type: {
      type: 'string',
      enum: ['none', 'captcha', 'login_required', 'access_denied', 'unsupported_reference', 'site_unavailable'],
    },
    notes: { type: 'string' },
  },
  required: ['lookup_outcome'],
};

function isCleanString(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim().toLowerCase();
  return (
    trimmed.length > 0 &&
    trimmed !== 'n/a' &&
    trimmed !== 'none' &&
    trimmed !== 'null' &&
    trimmed !== 'undefined' &&
    trimmed !== 'unavailable' &&
    trimmed !== 'unknown'
  );
}

function normalizeDateStr(val: unknown): string | null {
  if (!isCleanString(val)) return null;
  const parsed = parseIsoOrDate(val);
  return parsed ? parsed.toISOString() : val.trim();
}

export function verifyAndNormalizeExtraction(
  raw: unknown,
  expectedReference: string,
  sourceUrl: string
): ExtractionVerification {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingFields: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return {
      isValid: false,
      outcome: 'FAILED',
      missingFields: ['payload'],
      errors: ['Raw agent extraction is not an object or is empty.'],
      warnings: [],
      normalizedData: {},
    };
  }

  const record = raw as Record<string, unknown>;

  // 1. Restriction Detection
  const outcomeRaw = String(record.lookup_outcome || '').toLowerCase();
  const notesRaw = String(record.notes || '').toLowerCase();
  const restriction = String(record.restriction_type || '').toLowerCase();

  const isCaptcha = restriction === 'captcha' || notesRaw.includes('captcha') || outcomeRaw.includes('captcha');
  const isLogin = restriction === 'login_required' || outcomeRaw === 'needs_login' || notesRaw.includes('login') || notesRaw.includes('sign in');
  const isBlocked = restriction === 'access_denied' || outcomeRaw === 'blocked' || notesRaw.includes('access denied') || notesRaw.includes('forbidden') || notesRaw.includes('bot');
  const isNotFound = restriction === 'unsupported_reference' || outcomeRaw === 'not_found' || notesRaw.includes('not found') || notesRaw.includes('no records') || notesRaw.includes('no matching shipment');
  const isSiteUnavailable = restriction === 'site_unavailable' || notesRaw.includes('unavailable') || notesRaw.includes('timeout') || outcomeRaw === 'error';

  let outcome: ExtractionOutcome = 'COMPLETE';

  if (isCaptcha || isLogin || isBlocked) {
    outcome = 'BLOCKED';
    warnings.push(
      isCaptcha
        ? 'Carrier presented CAPTCHA challenge. Automated bypass forbidden by safety policy.'
        : isLogin
        ? 'Carrier portal requires authenticated customer account.'
        : 'Carrier portal blocked automated access or presented anti-bot challenge.'
    );
  } else if (isNotFound) {
    outcome = 'NOT_FOUND';
    warnings.push(`Carrier reported no shipment matching reference: ${expectedReference}`);
  } else if (isSiteUnavailable && !record.current_status) {
    outcome = 'FAILED';
    errors.push('Carrier portal was unreachable or returned an error.');
  }

  // 2. Reference Consistency
  const extractedRef = isCleanString(record.tracking_reference) ? record.tracking_reference.trim() : null;
  if (extractedRef && !extractedRef.toLowerCase().includes(expectedReference.toLowerCase()) && !expectedReference.toLowerCase().includes(extractedRef.toLowerCase())) {
    warnings.push(`Extracted tracking reference "${extractedRef}" differs from requested reference "${expectedReference}".`);
  }

  // 3. Normalized Core Fields
  const currentStatus = isCleanString(record.current_status) ? record.current_status.trim() : null;
  const origin = isCleanString(record.origin) ? record.origin.trim() : null;
  const destination = isCleanString(record.destination) ? record.destination.trim() : null;
  const currentLocation = isCleanString(record.current_location) ? record.current_location.trim() : null;
  const vesselOrFlight = isCleanString(record.vessel_or_flight) ? record.vessel_or_flight.trim() : null;
  const lastFreeDate = normalizeDateStr(record.last_free_date);

  const estimatedArrival = normalizeDateStr(record.estimated_arrival);
  const actualArrival = normalizeDateStr(record.actual_arrival);
  const estimatedDeparture = normalizeDateStr(record.estimated_departure);
  const actualDeparture = normalizeDateStr(record.actual_departure);

  if (!currentStatus) missingFields.push('current_status');
  if (!origin) missingFields.push('origin');
  if (!destination) missingFields.push('destination');
  if (!currentLocation) missingFields.push('current_location');
  if (!estimatedArrival && !actualArrival) missingFields.push('estimated_arrival');

  // 4. Milestone Normalization (Preserve Every Milestone)
  const milestones: ShipmentMilestone[] = [];
  if (Array.isArray(record.milestones)) {
    for (const m of record.milestones) {
      if (typeof m === 'string' && m.trim().length > 0) {
        milestones.push({ description: m.trim(), location: null, eventDate: null });
      } else if (m && typeof m === 'object') {
        const item = m as Record<string, unknown>;
        const desc = isCleanString(item.description) ? item.description.trim() : isCleanString(item.event) ? item.event.trim() : null;
        if (desc) {
          milestones.push({
            description: desc,
            location: isCleanString(item.location) ? item.location.trim() : null,
            eventDate: normalizeDateStr(item.timestamp || item.event_date || item.date),
          });
        }
      }
    }
  }

  // If status was retrieved but some key fields are missing, classify as PARTIAL
  if (outcome === 'COMPLETE') {
    if (!currentStatus && milestones.length === 0) {
      outcome = 'FAILED';
      errors.push('No verifiable status or milestone events extracted from carrier portal.');
    } else if (!estimatedArrival && !actualArrival && missingFields.length >= 2) {
      outcome = 'PARTIAL';
      warnings.push('Partial extraction: some expected fields (ETA/Location) were omitted by carrier.');
    }
  }

  const normalizedData: Record<string, unknown> = {
    trackingNumber: expectedReference,
    extractedReference: extractedRef || expectedReference,
    status: currentStatus,
    origin,
    destination,
    currentLocation,
    estimatedArrival,
    actualArrival,
    estimatedDeparture,
    actualDeparture,
    vesselOrFlight,
    lastFreeDate,
    milestones,
    sourceUrl,
    retrievedAt: new Date().toISOString(),
    notes: isCleanString(record.notes) ? record.notes.trim() : null,
  };

  return {
    isValid: errors.length === 0 && outcome !== 'FAILED',
    outcome,
    missingFields,
    errors,
    warnings,
    normalizedData,
  };
}
