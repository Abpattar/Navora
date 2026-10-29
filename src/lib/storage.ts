import type { ShipmentResult } from '@/lib/types';

const STORAGE_KEY = 'gfc.shipment-history.v1';

export function readHistory(): ShipmentResult[] {
  if (typeof window === 'undefined') return [];
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) return [];
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ShipmentResult => Boolean(
      item && typeof item === 'object' &&
      typeof (item as ShipmentResult).id === 'string' &&
      typeof (item as ShipmentResult).trackingNumber === 'string' &&
      typeof (item as ShipmentResult).carrierName === 'string'
    ));
  } catch {
    return [];
  }
}

export function writeHistory(items: ShipmentResult[]): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 200))); } catch { /* browser storage may be unavailable */ }
}

export function exportToCsv(items: ShipmentResult[], filename = 'shipment-history.csv'): void {
  if (typeof window === 'undefined') return;
  const headers = ['carrier', 'trackingNumber', 'lookupStatus', 'status', 'latestEvent', 'location', 'eventDate', 'estimatedArrival', 'origin', 'destination', 'sourceUrl', 'retrievedAt', 'warnings'];
  const cell = (value: unknown) => {
    const text = Array.isArray(value) ? value.join(' | ') : value == null ? '' : String(value);
    return `"${text.replaceAll('"', '""')}"`;
  };
  const rows = items.map((item) => headers.map((header) => cell((item as unknown as Record<string, unknown>)[header])).join(','));
  const csv = [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
