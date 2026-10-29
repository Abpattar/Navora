export type LookupStatus = 'success' | 'not_found' | 'needs_login' | 'blocked' | 'unsupported' | 'error';

export type CarrierId =
  | 'maersk'
  | 'msc'
  | 'cma-cgm'
  | 'hapag-lloyd'
  | 'cosco'
  | 'evergreen'
  | 'one'
  | 'oocl'
  | 'zim'
  | 'yang-ming';

export interface CarrierConfig {
  id: CarrierId;
  name: string;
  trackingUrl: string;
  integrationStatus: 'priority' | 'candidate';
  referenceHint: string;
  note: string;
}

export interface ShipmentMilestone {
  description: string;
  location: string | null;
  eventDate: string | null;
}

export interface ShipmentResult {
  id: string;
  carrier: CarrierId;
  carrierName: string;
  trackingNumber: string;
  lookupStatus: LookupStatus;
  status: string | null;
  latestEvent: string | null;
  location: string | null;
  eventDate: string | null;
  estimatedArrival: string | null;
  origin: string | null;
  destination: string | null;
  lastFreeDate: string | null;
  milestones: ShipmentMilestone[];
  sourceUrl: string;
  retrievedAt: string;
  warnings: string[];
  errorMessage?: string;
}

export interface TrackRequest {
  carrier: CarrierId;
  trackingNumber: string;
}

export interface TrackApiResponse {
  success: boolean;
  result?: ShipmentResult;
  error?: string;
  code?: string;
}

export interface BatchItem extends TrackRequest {
  rowId: string;
}

export interface BatchResult {
  rowId: string;
  result?: ShipmentResult;
  error?: string;
}
