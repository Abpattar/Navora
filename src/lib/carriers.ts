import type { CarrierConfig, CarrierId } from '@/lib/types';

export const CARRIERS: CarrierConfig[] = [
  // Priority Global Ocean Carriers
  {
    id: 'maersk',
    name: 'Maersk Line',
    trackingUrl: 'https://www.maersk.com/tracking/',
    integrationStatus: 'priority',
    referenceHint: 'Container (MSKU...) or Bill of Lading number',
    note: 'Primary global ocean tracking target. Public tracking page with real milestone extraction.',
    carrierType: 'ocean',
    allowedDomains: ['maersk.com', 'www.maersk.com'],
    supportedFields: ['status', 'latest_event', 'location', 'estimated_arrival', 'origin', 'destination', 'milestones'],
  },
  {
    id: 'msc',
    name: 'MSC Mediterranean Shipping Co.',
    trackingUrl: 'https://www.msc.com/en/track-a-shipment',
    integrationStatus: 'priority',
    referenceHint: 'Container (MEDU...), booking, or Bill of Lading reference',
    note: 'Priority global container carrier. Public tracking available.',
    carrierType: 'ocean',
    allowedDomains: ['msc.com', 'www.msc.com'],
    supportedFields: ['status', 'latest_event', 'location', 'estimated_arrival', 'origin', 'destination'],
  },
  {
    id: 'cma-cgm',
    name: 'CMA CGM',
    trackingUrl: 'https://www.cma-cgm.com/ebusiness/tracking',
    integrationStatus: 'candidate',
    referenceHint: 'Container, booking, or shipment reference',
    note: 'Candidate integration. Available fields depend on public page accessibility.',
    carrierType: 'ocean',
    allowedDomains: ['cma-cgm.com', 'www.cma-cgm.com'],
    supportedFields: ['status', 'latest_event', 'location', 'estimated_arrival'],
  },
  {
    id: 'hapag-lloyd',
    name: 'Hapag-Lloyd',
    trackingUrl: 'https://www.hapag-lloyd.com/solutions/tracking/',
    integrationStatus: 'candidate',
    referenceHint: 'Container (HLCU...), booking, or B/L number',
    note: 'Candidate integration. Public form available for container and B/L queries.',
    carrierType: 'ocean',
    allowedDomains: ['hapag-lloyd.com', 'www.hapag-lloyd.com'],
    supportedFields: ['status', 'latest_event', 'location', 'estimated_arrival', 'last_free_date'],
  },
  {
    id: 'cosco',
    name: 'COSCO Shipping Lines',
    trackingUrl: 'https://elines.coscoshipping.com/ebusiness/cargoTracking',
    integrationStatus: 'candidate',
    referenceHint: 'Container (COSU...), booking, or Bill of Lading reference',
    note: 'Candidate integration. Public tracking available, detailed logs may vary.',
    carrierType: 'ocean',
    allowedDomains: ['elines.coscoshipping.com', 'coscoshipping.com'],
    supportedFields: ['status', 'location', 'estimated_arrival'],
  },
  {
    id: 'evergreen',
    name: 'Evergreen Marine',
    trackingUrl: 'https://www.shipmentlink.com/servlet/TDB1_CargoTracking.do',
    integrationStatus: 'candidate',
    referenceHint: 'Container (EGLV...) or Bill of Lading number',
    note: 'Candidate integration via ShipmentLink portal.',
    carrierType: 'ocean',
    allowedDomains: ['shipmentlink.com', 'www.shipmentlink.com', 'evergreen-marine.com'],
    supportedFields: ['status', 'location', 'estimated_arrival'],
  },
  {
    id: 'one',
    name: 'Ocean Network Express (ONE)',
    trackingUrl: 'https://ecomm.one-line.com/ecom/CUP_HOM_3301.do',
    integrationStatus: 'candidate',
    referenceHint: 'Container (ONEU...) or Bill of Lading reference',
    note: 'Candidate integration. Global container tracking portal.',
    carrierType: 'ocean',
    allowedDomains: ['ecomm.one-line.com', 'one-line.com'],
    supportedFields: ['status', 'location', 'estimated_arrival'],
  },
  {
    id: 'oocl',
    name: 'OOCL',
    trackingUrl: 'https://www.oocl.com/eng/ourservices/eservices/cargotracking/Pages/default.aspx',
    integrationStatus: 'candidate',
    referenceHint: 'Container (OOLU...) or Bill of Lading reference',
    note: 'Candidate integration. E-services tracking portal.',
    carrierType: 'ocean',
    allowedDomains: ['oocl.com', 'www.oocl.com'],
    supportedFields: ['status', 'location', 'estimated_arrival'],
  },
  {
    id: 'zim',
    name: 'ZIM Integrated Shipping Services',
    trackingUrl: 'https://www.zim.com/tools/track-a-shipment',
    integrationStatus: 'candidate',
    referenceHint: 'Container (ZIMU...) or booking reference',
    note: 'Candidate integration. Public web tracking tool.',
    carrierType: 'ocean',
    allowedDomains: ['zim.com', 'www.zim.com'],
    supportedFields: ['status', 'location', 'estimated_arrival'],
  },
  {
    id: 'yang-ming',
    name: 'Yang Ming Marine Transport',
    trackingUrl: 'https://www.yangming.com/e-service/track_trace/track_trace_cargo_tracking.aspx',
    integrationStatus: 'candidate',
    referenceHint: 'Container (YMLU...) or Bill of Lading reference',
    note: 'Candidate integration. Public e-service portal.',
    carrierType: 'ocean',
    allowedDomains: ['yangming.com', 'www.yangming.com'],
    supportedFields: ['status', 'location', 'estimated_arrival'],
  },

  // Indian Logistics and National Infrastructure
  {
    id: 'ldb-india',
    name: 'LDB India (Logistics Data Bank)',
    trackingUrl: 'https://www.ldb.co.in/ldb/containersearch',
    integrationStatus: 'priority',
    referenceHint: 'Container Number (e.g. MSKU1234567, INBOM ICD)',
    note: 'National container tracking portal across Indian major ports, ICDs, and toll plazas using RFID.',
    carrierType: 'multimodal',
    allowedDomains: ['ldb.co.in', 'www.ldb.co.in', 'nldsl.in'],
    supportedFields: ['status', 'latest_event', 'location', 'event_date', 'origin', 'destination', 'milestones'],
  },
  {
    id: 'bluedart',
    name: 'Blue Dart Express (Third-Party)',
    trackingUrl: 'https://www.bluedart.com/trackdartresultthirdparty',
    integrationStatus: 'priority',
    referenceHint: 'Waybill / AWB Number (e.g. 12345678901)',
    note: 'Third-party public portal rendering static SSR HTML tables without complex JS tokens.',
    carrierType: 'surface',
    allowedDomains: ['bluedart.com', 'www.bluedart.com'],
    supportedFields: ['status', 'latest_event', 'location', 'event_date', 'estimated_arrival'],
  },
  {
    id: 'delhivery',
    name: 'Delhivery Supply Chain',
    trackingUrl: 'https://www.delhivery.com/tracking',
    integrationStatus: 'candidate',
    referenceHint: 'Waybill Number, Order ID or LTL Consignment Note',
    note: 'National freight, express parcel and partial-truckload network across India.',
    carrierType: 'surface',
    allowedDomains: ['delhivery.com', 'www.delhivery.com'],
    supportedFields: ['status', 'latest_event', 'location', 'event_date', 'estimated_arrival'],
  },
  {
    id: 'tci-express',
    name: 'TCI Express',
    trackingUrl: 'https://www.tciexpress.in/tracking.aspx',
    integrationStatus: 'candidate',
    referenceHint: 'Docket / Consignment Note Number',
    note: 'Specialized express cargo distribution across rail, surface and air freight corridors.',
    carrierType: 'surface',
    allowedDomains: ['tciexpress.in', 'www.tciexpress.in'],
    supportedFields: ['status', 'latest_event', 'location', 'event_date'],
  },
  {
    id: 'v-xpress',
    name: 'V-Xpress (V-Trans)',
    trackingUrl: 'https://v-xpress.com/track-and-trace/',
    integrationStatus: 'candidate',
    referenceHint: 'Docket or LR (Lorry Receipt) Number',
    note: 'Multimodal express cargo division of V-Trans India.',
    carrierType: 'surface',
    allowedDomains: ['v-xpress.com', 'www.v-xpress.com', 'vtransgroup.com'],
    supportedFields: ['status', 'latest_event', 'location', 'event_date'],
  },

  // Public Air Cargo Portals
  {
    id: 'air-cargo',
    name: 'Public Air Cargo Portal',
    trackingUrl: 'https://www.track-trace.com/aircargo',
    integrationStatus: 'candidate',
    referenceHint: 'Standard 11-digit Air Waybill (e.g. 020-12345678)',
    note: 'Global IATA air cargo tracking aggregator for international airline manifests.',
    carrierType: 'air',
    allowedDomains: ['track-trace.com', 'www.track-trace.com'],
    supportedFields: ['status', 'latest_event', 'location', 'event_date', 'origin', 'destination'],
  },

  // Third-Party Aggregators & Direct Clean Public Endpoints
  {
    id: 'track123',
    name: 'Track123 Universal Tracker',
    trackingUrl: 'https://www.track123.com/tracking/{ID}',
    integrationStatus: 'priority',
    referenceHint: 'Multi-courier tracking reference or parcel barcode',
    note: 'Universal logistics aggregator with clean DOM hierarchy and direct extraction.',
    carrierType: 'surface',
    allowedDomains: ['track123.com', 'www.track123.com'],
    supportedFields: ['status', 'latest_event', 'location', 'event_date', 'estimated_arrival', 'milestones'],
  },
  {
    id: 'fedex',
    name: 'FedEx Express (via Track123)',
    trackingUrl: 'https://www.track123.com/tracking/{ID}',
    integrationStatus: 'priority',
    referenceHint: '12-digit FedEx tracking reference (e.g. 398891812948)',
    note: 'FedEx express tracking routed via public aggregator DOM to bypass Cloudflare/Akamai stops.',
    carrierType: 'surface',
    allowedDomains: ['track123.com', 'www.track123.com', 'fedex.com'],
    supportedFields: ['status', 'latest_event', 'location', 'event_date', 'estimated_arrival', 'milestones'],
  },
  {
    id: 'ups',
    name: 'UPS Tracking (via Track123)',
    trackingUrl: 'https://www.track123.com/tracking/{ID}',
    integrationStatus: 'priority',
    referenceHint: '1Z tracking number (e.g. 1Z6R42A40438792344)',
    note: 'Full UPS event history rendered cleanly without browser-fingerprinting stops.',
    carrierType: 'surface',
    allowedDomains: ['track123.com', 'www.track123.com', 'ups.com'],
    supportedFields: ['status', 'latest_event', 'location', 'event_date', 'estimated_arrival', 'milestones'],
  },
  {
    id: 'usps',
    name: 'USPS Tracking (via Track123)',
    trackingUrl: 'https://www.track123.com/tracking/{ID}',
    integrationStatus: 'priority',
    referenceHint: 'USPS postal barcode (e.g. 9500109441760092147847)',
    note: 'Parses multi-stage scan checkpoints and facility timestamps directly.',
    carrierType: 'surface',
    allowedDomains: ['track123.com', 'www.track123.com', 'usps.com'],
    supportedFields: ['status', 'latest_event', 'location', 'event_date', 'estimated_arrival', 'milestones'],
  },
  {
    id: 'dhl',
    name: 'DHL Express (via Track123)',
    trackingUrl: 'https://www.track123.com/tracking/{ID}',
    integrationStatus: 'priority',
    referenceHint: 'Standard 10/11-digit AWB (e.g. 30184465961)',
    note: 'Fast DOM-based international express checkpoint extraction.',
    carrierType: 'air',
    allowedDomains: ['track123.com', 'www.track123.com', 'dhl.com'],
    supportedFields: ['status', 'latest_event', 'location', 'event_date', 'estimated_arrival', 'milestones'],
  },
  {
    id: 'amazon-shipping',
    name: 'Amazon Shipping (India)',
    trackingUrl: 'https://track.amazon.in/api/tracker/{ID}',
    integrationStatus: 'priority',
    referenceHint: '10–18 numeric digit Amazon tracking ID (e.g. 100000000000)',
    note: 'Direct unauthenticated public API returning nested JSON progressTracker and eventHistory.',
    carrierType: 'surface',
    allowedDomains: ['track.amazon.in', 'amazon.in', 'www.amazon.in'],
    supportedFields: ['status', 'latest_event', 'location', 'event_date', 'estimated_arrival', 'milestones'],
  },
  {
    id: 'tpc',
    name: 'The Professional Couriers (TPC)',
    trackingUrl: 'https://www.tpcindia.com/TPCWebService/TrackMobDe.ashx?podno={ID}',
    integrationStatus: 'priority',
    referenceHint: 'Branch code + numeric POD number (e.g. BLR1234567)',
    note: 'Raw plain text web service feed intended for mobile apps bypassing main website CAPTCHA entirely.',
    carrierType: 'surface',
    allowedDomains: ['tpcindia.com', 'www.tpcindia.com'],
    supportedFields: ['status', 'latest_event', 'location', 'event_date', 'origin', 'destination'],
  },
];

export function getCarrier(id: string): CarrierConfig | undefined {
  return CARRIERS.find((carrier) => carrier.id === id);
}

export function isCarrierId(id: string): id is CarrierId {
  return CARRIERS.some((carrier) => carrier.id === id);
}

const CARRIER_ALIASES: Record<string, CarrierId> = {
  // Maersk
  'maersk': 'maersk',
  'maersk-line': 'maersk',
  'maersk line': 'maersk',
  'ap moller maersk': 'maersk',
  'mullers': 'maersk',
  // MSC
  'msc': 'msc',
  'msc-line': 'msc',
  'mediterranean shipping company': 'msc',
  // CMA CGM
  'cma': 'cma-cgm',
  'cma-cgm': 'cma-cgm',
  'cma cgm': 'cma-cgm',
  'cma-cgm-line': 'cma-cgm',
  // Hapag Lloyd
  'hapag': 'hapag-lloyd',
  'hapag-lloyd': 'hapag-lloyd',
  'hapag lloyd': 'hapag-lloyd',
  'hl': 'hapag-lloyd',
  // COSCO
  'cosco': 'cosco',
  'cosco-shipping': 'cosco',
  'cosco shipping': 'cosco',
  'cosco shipping lines': 'cosco',
  // Evergreen
  'evergreen': 'evergreen',
  'evergreen-line': 'evergreen',
  'evergreen marine': 'evergreen',
  'emc': 'evergreen',
  // ONE
  'one': 'one',
  'ocean-network-express': 'one',
  'ocean network express': 'one',
  // OOCL
  'oocl': 'oocl',
  'orient overseas container line': 'oocl',
  // ZIM
  'zim': 'zim',
  'zim integrated': 'zim',
  // Yang Ming
  'yang-ming': 'yang-ming',
  'yang ming': 'yang-ming',
  'yml': 'yang-ming',
  // LDB
  'ldb': 'ldb-india',
  'ldb-india': 'ldb-india',
  'logistics data bank': 'ldb-india',
  'nldsl': 'ldb-india',
  'india container': 'ldb-india',
  // BlueDart
  'bluedart': 'bluedart',
  'blue-dart': 'bluedart',
  'blue dart': 'bluedart',
  'blue dart express': 'bluedart',
  // Delhivery
  'delhivery': 'delhivery',
  'delhivery-express': 'delhivery',
  'delhivery logistics': 'delhivery',
  // TCI Express
  'tci': 'tci-express',
  'tci-express': 'tci-express',
  'tci express': 'tci-express',
  // V-Xpress
  'vxpress': 'v-xpress',
  'v-xpress': 'v-xpress',
  'v xpress': 'v-xpress',
  'v-trans': 'v-xpress',
  'vtrans': 'v-xpress',
  // Air cargo
  'air': 'air-cargo',
  'air-cargo': 'air-cargo',
  'aircargo': 'air-cargo',
  'iata': 'air-cargo',
  'awb': 'air-cargo',
  // Track123 & Aggregators
  'track123': 'track123',
  'track-123': 'track123',
  'track 123': 'track123',
  'universal': 'track123',
  // FedEx
  'fedex': 'fedex',
  'fed-ex': 'fedex',
  'federal express': 'fedex',
  'fedex express': 'fedex',
  // UPS
  'ups': 'ups',
  'united parcel service': 'ups',
  'ups tracking': 'ups',
  // USPS
  'usps': 'usps',
  'u.s. postal service': 'usps',
  'us postal service': 'usps',
  'usps tracking': 'usps',
  'post': 'usps',
  // DHL
  'dhl': 'dhl',
  'dhl-express': 'dhl',
  'dhl express': 'dhl',
  'dhl air': 'dhl',
  // Amazon Shipping
  'amazon': 'amazon-shipping',
  'amazon-shipping': 'amazon-shipping',
  'amazon shipping': 'amazon-shipping',
  'amazon-india': 'amazon-shipping',
  'amazon in': 'amazon-shipping',
  'amazon logistics': 'amazon-shipping',
  // TPC India
  'tpc': 'tpc',
  'tpc-india': 'tpc',
  'tpc india': 'tpc',
  'the professional couriers': 'tpc',
  'professional couriers': 'tpc',
};

export function normalizeCarrierNameOrId(input: string): CarrierId | null {
  if (!input) return null;
  const cleaned = input.trim().toLowerCase().replaceAll(/[_.]+/g, '-').replace(/\s+/g, ' ');
  if (isCarrierId(cleaned)) return cleaned;
  if (CARRIER_ALIASES[cleaned]) return CARRIER_ALIASES[cleaned];

  // Try partial match
  for (const [alias, id] of Object.entries(CARRIER_ALIASES)) {
    if (cleaned.includes(alias) || alias.includes(cleaned)) {
      return id;
    }
  }
  return null;
}

// Strict SSRF protection and domain allowlist
const PRIVATE_IP_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

export function isSafeExternalUrl(targetUrl: string, allowedDomains?: string[]): { safe: boolean; reason?: string } {
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { safe: false, reason: 'Only HTTP and HTTPS URLs are permitted.' };
    }

    const hostname = parsed.hostname.toLowerCase();
    for (const pattern of PRIVATE_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        return { safe: false, reason: 'Access to private or local network addresses is forbidden.' };
      }
    }

    if (allowedDomains && allowedDomains.length > 0) {
      const isAllowed = allowedDomains.some((domain) => {
        const dom = domain.toLowerCase();
        return hostname === dom || hostname.endsWith(`.${dom}`);
      });
      if (!isAllowed) {
        return { safe: false, reason: `Host ${hostname} is not in the allowed domain list for this carrier.` };
      }
    }

    return { safe: true };
  } catch {
    return { safe: false, reason: 'Invalid URL format.' };
  }
}
