import * as XLSX from 'xlsx';
import { normalizeCarrierNameOrId } from '@/lib/carriers';
import type { CarrierId, DockId, ManifestImportRow, ManifestImportSummary } from '@/lib/types';
import { parseIsoOrDate } from '@/lib/logistics/eta-calculator';

function findMatchingHeader(headers: string[], patterns: RegExp[]): number {
  for (const pattern of patterns) {
    const idx = headers.findIndex((h) => pattern.test(h.toLowerCase().trim().replace(/[\s_-]+/g, '')));
    if (idx !== -1) return idx;
  }
  return -1;
}

export function parseSpreadsheetBuffer(buffer: ArrayBuffer | Uint8Array, filename = 'manifest.xlsx'): ManifestImportSummary {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('Spreadsheet file contains no worksheets.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet) {
    throw new Error('Unable to read the first worksheet.');
  }

  // Convert to 2D array
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false });
  if (rawRows.length < 2) {
    throw new Error('Spreadsheet must contain a header row and at least one data row.');
  }

  const rawHeaders = (rawRows[0] || []).map((h) => String(h || '').trim());
  const headerKeys = rawHeaders.map((h) => h.toLowerCase().trim().replace(/[\s_-]+/g, ''));

  // Detect column indices
  const shipmentIdIdx = findMatchingHeader(headerKeys, [
    /^shipmentid$/, /^shipmentno$/, /^shipment$/, /^id$/, /^orderid$/, /^refid$/
  ]);

  const trackingIdx = findMatchingHeader(headerKeys, [
    /^trackingnumber$/, /^trackingno$/, /^tracking$/, /^containernumber$/, /^containerno$/,
    /^container$/, /^awbnumber$/, /^awbno$/, /^awb$/, /^billoflading$/, /^bol$/, /^reference$/
  ]);

  const carrierIdx = findMatchingHeader(headerKeys, [
    /carrier/, /^shippingline$/, /^shipping$/, /^provider$/, /^logisticsline$/, /^portal$/, /^portalurl$/
  ]);

  const promisedEtaIdx = findMatchingHeader(headerKeys, [
    /^promisedeta$/, /^expectedeta$/, /^eta$/, /^arrivaldate$/, /^deliverydate$/, /^expectedarrival$/,
    /^promiseddelivery$/, /^delivery$/, /^promised$/
  ]);

  const dockIdx = findMatchingHeader(headerKeys, [
    /^assignedwarehousedock$/, /^assigneddock$/, /^dock$/, /^warehousedock$/, /^dockslot$/, /^unloadingdock$/
  ]);

  const originIdx = findMatchingHeader(headerKeys, [
    /^origin$/, /^portofloading$/, /^pol$/, /^from$/
  ]);

  const destinationIdx = findMatchingHeader(headerKeys, [
    /^destination$/, /^portofdischarge$/, /^pod$/, /^to$/
  ]);

  if (trackingIdx === -1 && carrierIdx === -1) {
    throw new Error(
      `Could not detect required columns. Detected headers: [${rawHeaders.join(', ')}]. Expected at least 'Tracking Number / Container' and 'Carrier'.`
    );
  }

  const rows: ManifestImportRow[] = [];
  const seenTrackingNumbers = new Set<string>();
  let duplicateCount = 0;

  for (let r = 1; r < rawRows.length; r++) {
    const rowData = rawRows[r];
    if (!rowData || !rowData.length || rowData.every((c) => c === undefined || c === null || String(c).trim() === '')) {
      continue;
    }

    const rowErrors: string[] = [];
    const rawShipmentId = shipmentIdIdx !== -1 ? String(rowData[shipmentIdIdx] ?? '').trim() : '';
    const rawTracking = trackingIdx !== -1 ? String(rowData[trackingIdx] ?? '').trim() : '';
    const rawCarrier = carrierIdx !== -1 ? String(rowData[carrierIdx] ?? '').trim() : '';
    const rawEta = promisedEtaIdx !== -1 ? rowData[promisedEtaIdx] : undefined;
    const rawDock = dockIdx !== -1 ? String(rowData[dockIdx] ?? '').trim() : '';
    const rawOrigin = originIdx !== -1 ? String(rowData[originIdx] ?? '').trim() : '';
    const rawDestination = destinationIdx !== -1 ? String(rowData[destinationIdx] ?? '').trim() : '';

    // Shipment ID default if missing
    const shipmentId = rawShipmentId || `FC-${1000 + r}`;

    // Tracking Number validation
    if (!rawTracking) {
      rowErrors.push('Missing tracking reference or container number.');
    } else if (rawTracking.length < 3) {
      rowErrors.push('Tracking reference must be at least 3 characters.');
    } else if (!/^[A-Za-z0-9][A-Za-z0-9 .\/_-]*$/.test(rawTracking)) {
      rowErrors.push('Tracking reference contains invalid characters.');
    }

    // Duplicate check
    const trackingKey = rawTracking.toUpperCase();
    if (seenTrackingNumbers.has(trackingKey)) {
      duplicateCount++;
      rowErrors.push(`Duplicate tracking reference "${rawTracking}" within this manifest.`);
    } else if (rawTracking) {
      seenTrackingNumbers.add(trackingKey);
    }

    // Carrier normalization
    let carrier: CarrierId = 'maersk';
    if (!rawCarrier) {
      rowErrors.push('Missing carrier or logistics provider.');
    } else {
      const normalized = normalizeCarrierNameOrId(rawCarrier);
      if (!normalized) {
        rowErrors.push(`Unrecognized carrier "${rawCarrier}". Please specify a supported carrier name.`);
      } else {
        carrier = normalized;
      }
    }

    // Date normalization
    let promisedEta: string | null = null;
    if (rawEta instanceof Date) {
      promisedEta = rawEta.toISOString();
    } else if (typeof rawEta === 'number') {
      // Excel serial date number
      const parsed = XLSX.SSF.parse_date_code(rawEta);
      if (parsed) {
        promisedEta = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H || 0, parsed.M || 0, parsed.S || 0)).toISOString();
      }
    } else if (typeof rawEta === 'string' && rawEta.trim().length > 0) {
      const parsed = parseIsoOrDate(rawEta);
      if (parsed) {
        promisedEta = parsed.toISOString();
      } else {
        rowErrors.push(`Invalid date format for Promised ETA: "${rawEta}".`);
      }
    }

    // Dock normalization
    let assignedDock: DockId | string | null = null;
    if (rawDock) {
      const lower = rawDock.toLowerCase();
      if (lower.includes('a')) assignedDock = 'Dock A';
      else if (lower.includes('b')) assignedDock = 'Dock B';
      else if (lower.includes('c')) assignedDock = 'Dock C';
      else assignedDock = rawDock;
    }

    rows.push({
      rowId: `row-${r}-${Date.now()}`,
      shipmentId,
      trackingNumber: rawTracking,
      carrier,
      carrierRaw: rawCarrier || 'Unknown',
      promisedEta,
      assignedDock,
      origin: rawOrigin || null,
      destination: rawDestination || null,
      isValid: rowErrors.length === 0,
      errors: rowErrors,
    });
  }

  const validRows = rows.filter((r) => r.isValid).length;
  const errorRows = rows.length - validRows;

  return {
    id: `manifest-${Date.now()}`,
    filename,
    totalRows: rows.length,
    validRows,
    errorRows,
    duplicateRows: duplicateCount,
    rows,
    importedAt: new Date().toISOString(),
  };
}
