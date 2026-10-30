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
    name: 'Blue Dart Express',
    trackingUrl: 'https://www.bluedart.com/tracking',
    integrationStatus: 'candidate',
    referenceHint: 'Waybill / AWB Number (e.g. 12345678901)',
    note: 'Leading Indian express logistics and domestic air cargo provider.',
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
