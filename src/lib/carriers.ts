import type { CarrierConfig, CarrierId } from '@/lib/types';

export const CARRIERS: CarrierConfig[] = [
  {
    id: 'maersk', name: 'Maersk', trackingUrl: 'https://www.maersk.com/tracking/',
    integrationStatus: 'priority', referenceHint: 'Container or Bill of Lading number',
    note: 'Priority for the first live demo. Exact fields depend on the shipment and public page access.',
  },
  {
    id: 'msc', name: 'MSC', trackingUrl: 'https://www.msc.com/en/track-a-shipment',
    integrationStatus: 'priority', referenceHint: 'Container, booking, or Bill of Lading reference',
    note: 'Priority for the first live demo. Some shipment details may require an account.',
  },
  {
    id: 'cma-cgm', name: 'CMA CGM', trackingUrl: 'https://www.cma-cgm.com/ebusiness/tracking',
    integrationStatus: 'candidate', referenceHint: 'Container or shipment reference',
    note: 'Candidate integration; manually verify the public page before presenting as working.',
  },
  {
    id: 'hapag-lloyd', name: 'Hapag-Lloyd', trackingUrl: 'https://www.hapag-lloyd.com/solutions/tracking/',
    integrationStatus: 'candidate', referenceHint: 'Container, booking, or Bill of Lading number',
    note: 'Candidate integration; available fields may vary by reference type.',
  },
  {
    id: 'cosco', name: 'COSCO Shipping Lines', trackingUrl: 'https://elines.coscoshipping.com/ebusiness/cargoTracking',
    integrationStatus: 'candidate', referenceHint: 'Container, booking, or Bill of Lading reference',
    note: 'Candidate integration; detailed information may require login.',
  },
  {
    id: 'evergreen', name: 'Evergreen', trackingUrl: 'https://www.shipmentlink.com/servlet/TDB1_CargoTracking.do',
    integrationStatus: 'candidate', referenceHint: 'Container or shipment reference',
    note: 'Candidate integration; confirm the public tracking form still works.',
  },
  {
    id: 'one', name: 'Ocean Network Express (ONE)', trackingUrl: 'https://ecomm.one-line.com/ecom/CUP_HOM_3301.do',
    integrationStatus: 'candidate', referenceHint: 'Container or Bill of Lading reference',
    note: 'Candidate integration; page behavior may vary by region.',
  },
  {
    id: 'oocl', name: 'OOCL', trackingUrl: 'https://www.oocl.com/eng/ourservices/eservices/cargotracking/Pages/default.aspx',
    integrationStatus: 'candidate', referenceHint: 'Container or Bill of Lading reference',
    note: 'Candidate integration; some tracking pages may require additional verification.',
  },
  {
    id: 'zim', name: 'ZIM', trackingUrl: 'https://www.zim.com/tools/track-a-shipment',
    integrationStatus: 'candidate', referenceHint: 'Container or shipment reference',
    note: 'Candidate integration; verify returned fields on the official page.',
  },
  {
    id: 'yang-ming', name: 'Yang Ming', trackingUrl: 'https://www.yangming.com/e-service/track_trace/track_trace_cargo_tracking.aspx',
    integrationStatus: 'candidate', referenceHint: 'Container or Bill of Lading reference',
    note: 'Candidate integration; verify page accessibility before relying on it.',
  },
];

export function getCarrier(id: string): CarrierConfig | undefined {
  return CARRIERS.find((carrier) => carrier.id === id);
}

export function isCarrierId(id: string): id is CarrierId {
  return CARRIERS.some((carrier) => carrier.id === id);
}
