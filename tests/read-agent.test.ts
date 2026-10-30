import { describe, it, expect } from 'vitest';
import { verifyAndNormalizeExtraction } from '@/lib/tinyfish/validation';

describe('READ Tracking Extraction Verification Layer', () => {
  it('classifies complete structured extraction as COMPLETE', () => {
    const raw = {
      tracking_reference: 'MSKU9070323',
      lookup_outcome: 'success',
      current_status: 'Vessel in transit to Los Angeles',
      origin: 'Shanghai Port',
      destination: 'Port of Los Angeles',
      current_location: 'Pacific Ocean',
      estimated_arrival: '2026-11-05T18:00:00.000Z',
      vessel_or_flight: 'MAERSK MC-KINNEY MOLLER',
      last_free_date: '2026-11-10T23:59:00.000Z',
      milestones: [
        { description: 'Vessel departure from Shanghai', location: 'Shanghai', timestamp: '2026-10-25T10:00:00.000Z' },
        { description: 'Customs pre-clearance initiated', location: 'Los Angeles', timestamp: '2026-10-28T14:00:00.000Z' },
      ],
    };

    const verification = verifyAndNormalizeExtraction(raw, 'MSKU9070323', 'https://www.maersk.com/tracking');

    expect(verification.isValid).toBe(true);
    expect(verification.outcome).toBe('COMPLETE');
    expect(verification.normalizedData.status).toBe('Vessel in transit to Los Angeles');
    expect((verification.normalizedData.milestones as any[]).length).toBe(2);
    expect(verification.missingFields.length).toBe(0);
  });

  it('detects carrier bot protection / captcha restriction without attempting bypass', () => {
    const raw = {
      lookup_outcome: 'blocked',
      restriction_type: 'captcha',
      notes: 'Cloudflare Turnstile challenge presented on carrier portal.',
    };

    const verification = verifyAndNormalizeExtraction(raw, 'MEDU8456123', 'https://www.msc.com/track-a-shipment');

    expect(verification.outcome).toBe('BLOCKED');
    expect(verification.warnings.some((w) => w.toLowerCase().includes('captcha'))).toBe(true);
  });

  it('detects unrecorded shipment as NOT_FOUND', () => {
    const raw = {
      lookup_outcome: 'not_found',
      restriction_type: 'unsupported_reference',
      notes: 'No container or booking records matched reference.',
    };

    const verification = verifyAndNormalizeExtraction(raw, 'UNKNOWN99999', 'https://www.cma-cgm.com');

    expect(verification.outcome).toBe('NOT_FOUND');
    expect(verification.warnings.some((w) => w.includes('UNKNOWN99999'))).toBe(true);
  });
});
