import { describe, expect, it } from 'vitest';
import { runTrackingAgentSSE, TinyFishLookupError } from '@/lib/tinyfish/client';
import { isSafeExternalUrl } from '@/lib/carriers';

describe('TinyFish Autonomous Client - Security & SSRF', () => {
  it('blocks private network IP addresses (SSRF prevention)', () => {
    expect(isSafeExternalUrl('http://127.0.0.1:8080/admin').safe).toBe(false);
    expect(isSafeExternalUrl('http://localhost:3000').safe).toBe(false);
    expect(isSafeExternalUrl('http://192.168.1.1/router').safe).toBe(false);
    expect(isSafeExternalUrl('http://10.0.0.1/internal').safe).toBe(false);
    expect(isSafeExternalUrl('http://169.254.169.254/metadata').safe).toBe(false);
  });

  it('validates against allowed domains for carrier config', () => {
    const allowed = ['maersk.com', 'www.maersk.com'];
    expect(isSafeExternalUrl('https://www.maersk.com/tracking/', allowed).safe).toBe(true);
    expect(isSafeExternalUrl('https://malicious-site.com/track', allowed).safe).toBe(false);
    expect(isSafeExternalUrl('ftp://www.maersk.com', allowed).safe).toBe(false);
  });

  it('rejects execution when TINYFISH_API_KEY is not configured', async () => {
    const original = process.env.TINYFISH_API_KEY;
    delete process.env.TINYFISH_API_KEY;

    try {
      await expect(
        runTrackingAgentSSE({
          carrier: {
            id: 'maersk',
            name: 'Maersk',
            trackingUrl: 'https://www.maersk.com/tracking/',
            integrationStatus: 'priority',
            referenceHint: 'Container number',
            note: 'Test note',
            carrierType: 'ocean',
            allowedDomains: ['maersk.com', 'www.maersk.com'],
          },
          trackingNumber: 'MSKU1234567',
        })
      ).rejects.toThrow(TinyFishLookupError);
    } finally {
      process.env.TINYFISH_API_KEY = original;
    }
  });
});
