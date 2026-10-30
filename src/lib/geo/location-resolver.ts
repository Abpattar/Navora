import { GLOBAL_PORTS, MAJOR_CITIES } from './port-database';
import type { LocationAccuracy, ShipmentLocation } from '@/lib/types';
import { getCachedCoordinates, saveCachedCoordinates } from '@/lib/db';

export interface ResolveOptions {
  explicitLat?: number | null;
  explicitLng?: number | null;
  sourceContext?: string;
  skipCache?: boolean;
}

function cleanLocationQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/[,\/().-]+/g, ' ')
    .replace(/\b(terminal|port|harbour|wharf|pier|icd|cfs|depot|docks|berth|gate)\b/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesCandidate(cleanedQuery: string, candidate: string): boolean {
  if (!candidate || !cleanedQuery) return false;
  const target = candidate.toLowerCase().trim();
  if (!target) return false;

  const escaped = escapeRegex(target);
  const regex = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i');
  return regex.test(cleanedQuery);
}

export function resolveLocationCoordinates(
  locationQuery: string | null | undefined,
  options: ResolveOptions = {}
): ShipmentLocation {
  const timestamp = new Date().toISOString();

  // Priority 1: Explicit coordinates from carrier/agent
  if (
    typeof options.explicitLat === 'number' &&
    typeof options.explicitLng === 'number' &&
    !Number.isNaN(options.explicitLat) &&
    !Number.isNaN(options.explicitLng) &&
    options.explicitLat >= -90 && options.explicitLat <= 90 &&
    options.explicitLng >= -180 && options.explicitLng <= 180
  ) {
    return {
      latitude: options.explicitLat,
      longitude: options.explicitLng,
      accuracy: 'EXACT_GPS',
      source: options.sourceContext || 'Carrier GPS telemetry',
      resolvedAt: timestamp,
      resolvedName: locationQuery || 'GPS Coordinates',
    };
  }

  if (!locationQuery || !locationQuery.trim() || /^(unknown|unavailable|n\/a|null|none)$/i.test(locationQuery.trim())) {
    return {
      latitude: null,
      longitude: null,
      accuracy: 'UNKNOWN',
      source: 'No location provided',
      resolvedAt: timestamp,
      resolvedName: null,
    };
  }

  const queryKey = locationQuery.trim();

  // Check persistent DB cache
  if (!options.skipCache) {
    const cached = getCachedCoordinates(queryKey);
    if (cached) {
      return cached;
    }
  }

  const cleaned = cleanLocationQuery(queryKey);

  // Priority 2: Verified Port Database
  for (const port of GLOBAL_PORTS) {
    const matchesName = matchesCandidate(cleaned, port.name);
    const matchesCode = matchesCandidate(cleaned, port.unlocode);
    const matchesAlias = port.aliases.some((alias) => matchesCandidate(cleaned, alias));

    if (matchesName || matchesCode || matchesAlias) {
      const resolved: ShipmentLocation = {
        latitude: port.latitude,
        longitude: port.longitude,
        accuracy: 'PORT_APPROXIMATE',
        source: `UN/LOCODE ${port.unlocode} (${port.name})`,
        resolvedAt: timestamp,
        resolvedName: port.name,
      };
      if (!options.skipCache) {
        saveCachedCoordinates(queryKey, resolved);
      }
      return resolved;
    }
  }

  // Priority 3: Verified City Database
  for (const city of MAJOR_CITIES) {
    const matchesName = matchesCandidate(cleaned, city.name);
    const matchesAlias = city.aliases.some((alias) => matchesCandidate(cleaned, alias));

    if (matchesName || matchesAlias) {
      const resolved: ShipmentLocation = {
        latitude: city.latitude,
        longitude: city.longitude,
        accuracy: 'CITY_APPROXIMATE',
        source: `Verified city hub (${city.name}, ${city.country})`,
        resolvedAt: timestamp,
        resolvedName: `${city.name}, ${city.country}`,
      };
      if (!options.skipCache) {
        saveCachedCoordinates(queryKey, resolved);
      }
      return resolved;
    }
  }

  // Priority 4: UNKNOWN (Never guess or fabricate coordinates)
  const unresolved: ShipmentLocation = {
    latitude: null,
    longitude: null,
    accuracy: 'UNKNOWN',
    source: `Unresolved location name: "${locationQuery}"`,
    resolvedAt: timestamp,
    resolvedName: locationQuery,
  };
  if (!options.skipCache) {
    saveCachedCoordinates(queryKey, unresolved);
  }
  return unresolved;
}
