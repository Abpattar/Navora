import type { GeoPoint } from './types';

export function calculateDistanceKm(p1: GeoPoint, p2: GeoPoint): number {
  const R = 6371; // Earth radius in km
  const dLat = ((p2.latitude - p1.latitude) * Math.PI) / 180;
  const dLon = ((p2.longitude - p1.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.latitude * Math.PI) / 180) *
      Math.cos((p2.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function calculateDistanceNauticalMiles(p1: GeoPoint, p2: GeoPoint): number {
  return Math.round(calculateDistanceKm(p1, p2) * 0.539957);
}

/**
 * Creates intermediate points along a great-circle or slightly curved arc
 * to display a visual schematic route line on the map.
 */
export function generateCurvedRoutePoints(p1: GeoPoint, p2: GeoPoint, numPoints = 15): [number, number][] {
  const points: [number, number][] = [];
  const midLat = (p1.latitude + p2.latitude) / 2;
  const midLng = (p1.longitude + p2.longitude) / 2;

  // Add a subtle geographic offset to simulate a maritime arc rather than a flat straight line
  const dLng = p2.longitude - p1.longitude;
  const curvature = Math.min(10, Math.abs(dLng) * 0.15) * (dLng >= 0 ? 1 : -1);

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    // Quadratic bezier curve interpolation
    const lat = (1 - t) * (1 - t) * p1.latitude + 2 * (1 - t) * t * (midLat + curvature * 0.5) + t * t * p2.latitude;
    const lng = (1 - t) * (1 - t) * p1.longitude + 2 * (1 - t) * t * midLng + t * t * p2.longitude;
    points.push([lat, lng]);
  }

  return points;
}

export function calculateBoundingBox(points: GeoPoint[]): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
} | null {
  if (!points.length) return null;

  let minLat = points[0].latitude;
  let maxLat = points[0].latitude;
  let minLng = points[0].longitude;
  let maxLng = points[0].longitude;

  for (const p of points) {
    if (p.latitude < minLat) minLat = p.latitude;
    if (p.latitude > maxLat) maxLat = p.latitude;
    if (p.longitude < minLng) minLng = p.longitude;
    if (p.longitude > maxLng) maxLng = p.longitude;
  }

  return { minLat, maxLat, minLng, maxLng };
}
