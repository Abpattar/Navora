import type { LocationAccuracy } from '@/lib/types';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface ResolvedLocation {
  latitude: number | null;
  longitude: number | null;
  accuracy: LocationAccuracy;
  source: string;
  resolvedName: string | null;
  unlocode?: string;
  country?: string;
}

export interface PortRecord {
  unlocode: string;
  name: string;
  aliases: string[];
  country: string;
  latitude: number;
  longitude: number;
  type: 'seaport' | 'icd' | 'airport' | 'hub';
}

export interface CityRecord {
  name: string;
  aliases: string[];
  country: string;
  latitude: number;
  longitude: number;
}
