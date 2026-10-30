export type LookupStatus = 'success' | 'not_found' | 'needs_login' | 'blocked' | 'unsupported' | 'error' | 'pending' | 'running';

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
  | 'yang-ming'
  | 'ldb-india'
  | 'bluedart'
  | 'delhivery'
  | 'tci-express'
  | 'v-xpress'
  | 'air-cargo';

export interface CarrierConfig {
  id: CarrierId;
  name: string;
  trackingUrl: string;
  integrationStatus: 'priority' | 'candidate' | 'experimental';
  referenceHint: string;
  note: string;
  carrierType: 'ocean' | 'air' | 'surface' | 'multimodal';
  allowedDomains: string[];
  supportedFields?: string[];
}

export interface ShipmentMilestone {
  description: string;
  location: string | null;
  eventDate: string | null;
}

export type ShipmentStatus =
  | 'IN_TRANSIT'
  | 'DELAYED'
  | 'CUSTOMS_HOLD'
  | 'ARRIVED_AT_TERMINAL'
  | 'DELIVERED'
  | 'UNKNOWN';

export type LocationAccuracy =
  | 'EXACT_GPS'
  | 'PORT_APPROXIMATE'
  | 'CITY_APPROXIMATE'
  | 'UNKNOWN';

export interface ShipmentLocation {
  latitude: number | null;
  longitude: number | null;
  accuracy: LocationAccuracy;
  source: string;
  resolvedAt: string;
  resolvedName: string | null;
}

export interface SLARisk {
  isBreached: boolean;
  isAtRisk: boolean;
  riskLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  delayHours: number;
  delayDays: number;
  reason: string;
  classification: 'EARLY' | 'ON_TIME' | 'LATE' | 'UNKNOWN';
}

export interface DemurrageEstimate {
  freeTimeDays: number;
  freeTimeExpiry: string | null;
  dailyRate: number;
  currency: string;
  daysOverdue: number;
  estimatedDemurrage: number;
  detentionDaysOverdue: number;
  estimatedDetention: number;
  totalExposure: number;
  isCustomsHold: boolean;
  notes: string;
}

export type DockId = 'Dock A' | 'Dock B' | 'Dock C';

export interface DockBooking {
  id: string;
  shipmentId: string;
  trackingNumber: string;
  carrierName: string;
  dockId: DockId;
  slotTime: string; // ISO date-time
  status: 'CONFIRMED' | 'RESCHEDULED' | 'CANCELLED';
  confirmationId: string;
  originalBookingId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RescheduleAction {
  id: string;
  shipmentId: string;
  trackingNumber: string;
  carrier: CarrierId;
  originalBookingId: string;
  originalSlotTime: string;
  originalDockId: DockId;
  recommendedDockId: DockId;
  recommendedSlotTime: string;
  status: 'PENDING' | 'APPROVAL_REQUIRED' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  confirmationId?: string;
  reason: string;
  createdAt: string;
  executedAt?: string;
  error?: string;
}

export interface Shipment {
  id: string;
  manifestId?: string;
  shipmentId: string; // e.g. SH-8821 or user reference
  trackingNumber: string;
  carrier: CarrierId;
  carrierName: string;
  origin: string | null;
  destination: string | null;
  promisedEta: string | null;
  assignedDock: DockId | string | null;
  assignedDockSlot: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShipmentTracking {
  id: string;
  shipmentId: string;
  trackingNumber: string;
  carrier: CarrierId;
  carrierName: string;
  lookupStatus: LookupStatus;
  currentStatus: ShipmentStatus;
  rawStatus: string | null;
  currentLocation: string | null;
  liveEta: string | null;
  isDelayed: boolean;
  latestMilestone: string | null;
  lastFreeDate: string | null;
  eventDate: string | null;
  sourceUrl: string;
  retrievedAt: string;
  milestones: ShipmentMilestone[];
  warnings: string[];
  errorMessage?: string;
  agentRunId?: string;
}

export interface EnrichedShipment {
  shipment: Shipment;
  tracking?: ShipmentTracking;
  originLocation?: ShipmentLocation;
  currentLocation?: ShipmentLocation;
  destinationLocation?: ShipmentLocation;
  sla?: SLARisk;
  demurrage?: DemurrageEstimate;
  booking?: DockBooking;
  rescheduleAction?: RescheduleAction;
}

export interface DisruptionAlert {
  id: string;
  title: string;
  category: 'PORT_CONGESTION' | 'WEATHER' | 'LABOR_STRIKE' | 'CUSTOMS' | 'GEOPOLITICAL' | 'OTHER';
  affectedLocation: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  summary: string;
  source: string;
  publishedAt: string;
  relatedShipmentIds: string[];
}

export type AgentType = 'TRACKING' | 'WAREHOUSE' | 'INTELLIGENCE';
export type AgentRunStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type AgentEventType = 'STARTED' | 'STREAMING_URL' | 'PROGRESS' | 'HEARTBEAT' | 'COMPLETE' | 'FAILED' | 'LOG';

export interface AgentRun {
  id: string;
  runId: string;
  agentType: AgentType;
  targetShipmentId?: string;
  targetReference?: string;
  status: AgentRunStatus;
  startTime: string;
  endTime?: string;
  streamingUrl?: string;
  extractedOutput?: unknown;
  error?: string;
  confirmationId?: string;
  stepsCount: number;
}

export interface AgentEvent {
  id: string;
  runId: string;
  type: AgentEventType;
  timestamp: string;
  message: string;
  payload?: unknown;
}

// Retain legacy interfaces for full backward compatibility
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

export interface ManifestImportRow {
  rowId: string;
  shipmentId: string;
  trackingNumber: string;
  carrier: CarrierId;
  carrierRaw: string;
  promisedEta: string | null;
  assignedDock: DockId | string | null;
  origin?: string | null;
  destination?: string | null;
  isValid: boolean;
  errors: string[];
}

export interface ManifestImportSummary {
  id: string;
  filename: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
  rows: ManifestImportRow[];
  importedAt: string;
}
