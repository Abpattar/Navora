import { describe, expect, it } from 'vitest';
import { resolveLocationCoordinates } from '@/lib/geo/location-resolver';
import { calculateDistanceKm, generateCurvedRoutePoints } from '@/lib/geo/coordinate-utils';

describe('Global Map - Geographical Coordinate Resolution', () => {
  it('prefers explicit carrier GPS coordinates over database lookup (Priority 1)', () => {
    const loc = resolveLocationCoordinates('Somewhere in Pacific', {
      explicitLat: 15.1234,
      explicitLng: 110.5678,
      skipCache: true,
    });

    expect(loc.accuracy).toBe('EXACT_GPS');
    expect(loc.latitude).toBe(15.1234);
    expect(loc.longitude).toBe(110.5678);
  });

  it('resolves major container ports with UN/LOCODE coordinates (Priority 2)', () => {
    const shanghai = resolveLocationCoordinates('Shanghai Port, China', { skipCache: true });
    expect(shanghai.accuracy).toBe('PORT_APPROXIMATE');
    expect(shanghai.latitude).toBeCloseTo(31.23, 1);
    expect(shanghai.longitude).toBeCloseTo(121.47, 1);

    const jnpt = resolveLocationCoordinates('JNPT Nhava Sheva Terminal', { skipCache: true });
    expect(jnpt.accuracy).toBe('PORT_APPROXIMATE');
    expect(jnpt.latitude).toBeCloseTo(18.95, 1);
    expect(jnpt.longitude).toBeCloseTo(72.95, 1);

    const rotterdam = resolveLocationCoordinates('Port of Rotterdam Maasvlakte', { skipCache: true });
    expect(rotterdam.accuracy).toBe('PORT_APPROXIMATE');
    expect(rotterdam.latitude).toBeCloseTo(51.92, 1);
  });

  it('resolves cities to CITY_APPROXIMATE when not a seaport (Priority 3)', () => {
    const city = resolveLocationCoordinates('Bengaluru, Karnataka', { skipCache: true });
    expect(city.accuracy).toBe('CITY_APPROXIMATE');
    expect(city.latitude).toBeCloseTo(12.97, 1);
    expect(city.longitude).toBeCloseTo(77.59, 1);
  });

  it('returns UNKNOWN with null coordinates when location cannot be matched (Priority 4)', () => {
    const unknown = resolveLocationCoordinates('Atlantis Deep Trench Facility', { skipCache: true });
    expect(unknown.accuracy).toBe('UNKNOWN');
    expect(unknown.latitude).toBeNull();
    expect(unknown.longitude).toBeNull();
  });

  it('never randomly fabricates coordinates for missing inputs', () => {
    const blank = resolveLocationCoordinates('', { skipCache: true });
    expect(blank.latitude).toBeNull();
    expect(blank.longitude).toBeNull();
    expect(blank.accuracy).toBe('UNKNOWN');

    const na = resolveLocationCoordinates('N/A', { skipCache: true });
    expect(na.latitude).toBeNull();
    expect(na.longitude).toBeNull();
  });

  it('calculates great circle distances accurately', () => {
    // Mumbai (18.95, 72.95) to Singapore (1.29, 103.85) is roughly ~3,900 km
    const mumbai = { latitude: 18.9499, longitude: 72.9515 };
    const singapore = { latitude: 1.29027, longitude: 103.851959 };

    const distance = calculateDistanceKm(mumbai, singapore);
    expect(distance).toBeGreaterThan(3500);
    expect(distance).toBeLessThan(4200);
  });

  it('generates intermediate curved route points between two ports', () => {
    const origin = { latitude: 31.23, longitude: 121.47 };
    const dest = { latitude: 13.08, longitude: 80.27 };

    const points = generateCurvedRoutePoints(origin, dest, 10);
    expect(points.length).toBe(11);
    expect(points[0][0]).toBeCloseTo(31.23, 1);
    expect(points[10][0]).toBeCloseTo(13.08, 1);
  });
});
