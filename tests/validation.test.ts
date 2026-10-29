import { describe, expect, it } from 'vitest';
import { trackRequestSchema } from '@/lib/validation';
import { getCarrier, isCarrierId } from '@/lib/carriers';

describe('carrier registry', () => {
  it('contains the two priority carriers', () => {
    expect(getCarrier('maersk')?.integrationStatus).toBe('priority');
    expect(getCarrier('msc')?.integrationStatus).toBe('priority');
  });

  it('does not accept arbitrary carrier IDs', () => {
    expect(isCarrierId('maersk')).toBe(true);
    expect(isCarrierId('unknown-carrier')).toBe(false);
  });
});

describe('tracking request validation', () => {
  it('accepts a supported carrier and reference', () => {
    const result = trackRequestSchema.safeParse({ carrier: 'maersk', trackingNumber: 'ABCD1234567' });
    expect(result.success).toBe(true);
  });

  it('rejects a blank or too-short reference', () => {
    expect(trackRequestSchema.safeParse({ carrier: 'maersk', trackingNumber: '' }).success).toBe(false);
    expect(trackRequestSchema.safeParse({ carrier: 'maersk', trackingNumber: 'A' }).success).toBe(false);
  });

  it('rejects an unknown carrier', () => {
    expect(trackRequestSchema.safeParse({ carrier: 'made-up', trackingNumber: 'ABCD1234' }).success).toBe(false);
  });
});
