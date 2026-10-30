import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseSpreadsheetBuffer } from '@/lib/excel/parser';
import { generateEnrichedWorkbook } from '@/lib/excel/exporter';
import type { EnrichedShipment } from '@/lib/types';

describe('Excel & Manifest Engine', () => {
  it('parses a valid XLSX buffer with auto-detected columns', () => {
    const data = [
      ['Shipment ID', 'Container Number', 'Shipping Carrier', 'Promised ETA', 'Assigned Warehouse Dock'],
      ['SH-101', 'MSKU1234567', 'Maersk Line', '2026-11-01T10:00:00Z', 'Dock A'],
      ['SH-102', 'MEDU9876543', 'MSC', '2026-11-02T14:00:00Z', 'Dock B'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Shipments');
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    const summary = parseSpreadsheetBuffer(buffer, 'manifest.xlsx');
    expect(summary.totalRows).toBe(2);
    expect(summary.validRows).toBe(2);
    expect(summary.errorRows).toBe(0);
    expect(summary.rows[0].trackingNumber).toBe('MSKU1234567');
    expect(summary.rows[0].carrier).toBe('maersk');
    expect(summary.rows[0].assignedDock).toBe('Dock A');
    expect(summary.rows[1].carrier).toBe('msc');
  });

  it('parses CSV input accurately', () => {
    const csvContent = `Shipment ID,Tracking No,Carrier,Promised ETA\nSH-201,COSU8877665,COSCO,2026-11-05T08:00:00Z\nSH-202,BLU12345678,Blue Dart,2026-11-06T12:00:00Z`;
    const encoder = new TextEncoder();
    const buffer = encoder.encode(csvContent);

    const summary = parseSpreadsheetBuffer(buffer, 'shipments.csv');
    expect(summary.totalRows).toBe(2);
    expect(summary.validRows).toBe(2);
    expect(summary.rows[0].carrier).toBe('cosco');
    expect(summary.rows[1].carrier).toBe('bluedart');
  });

  it('detects missing required columns and throws informative error', () => {
    const data = [
      ['Customer Name', 'Invoice Number', 'Amount'],
      ['John Doe', 'INV-100', '500'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    expect(() => parseSpreadsheetBuffer(buffer)).toThrow(/Could not detect required columns/);
  });

  it('detects duplicate tracking numbers within the same manifest', () => {
    const data = [
      ['Shipment ID', 'Tracking Number', 'Carrier'],
      ['SH-301', 'MSKU1111111', 'Maersk'],
      ['SH-302', 'MSKU1111111', 'Maersk'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    const summary = parseSpreadsheetBuffer(buffer);
    expect(summary.totalRows).toBe(2);
    expect(summary.duplicateRows).toBe(1);
    expect(summary.rows[1].isValid).toBe(false);
    expect(summary.rows[1].errors.some((e) => e.includes('Duplicate'))).toBe(true);
  });

  it('generates an enriched export workbook with all required audit columns', () => {
    const mockEnriched: EnrichedShipment[] = [
      {
        shipment: {
          id: 's-1',
          shipmentId: 'SH-EXP-1',
          trackingNumber: 'MSKU9988776',
          carrier: 'maersk',
          carrierName: 'Maersk Line',
          origin: 'Shanghai',
          destination: 'JNPT',
          promisedEta: '2026-11-01T10:00:00Z',
          assignedDock: 'Dock A',
          assignedDockSlot: '2026-11-01T10:00:00Z',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        tracking: {
          id: 't-1',
          shipmentId: 's-1',
          trackingNumber: 'MSKU9988776',
          carrier: 'maersk',
          carrierName: 'Maersk Line',
          lookupStatus: 'success',
          currentStatus: 'IN_TRANSIT',
          rawStatus: 'Vessel Departed',
          currentLocation: 'Singapore Port',
          liveEta: '2026-11-01T12:00:00Z',
          isDelayed: false,
          latestMilestone: 'Transshipment departure',
          lastFreeDate: '2026-11-08T00:00:00Z',
          eventDate: '2026-10-29T10:00:00Z',
          sourceUrl: 'https://www.maersk.com/tracking/',
          retrievedAt: new Date().toISOString(),
          milestones: [],
          warnings: [],
        },
        booking: {
          id: 'b-1',
          shipmentId: 's-1',
          trackingNumber: 'MSKU9988776',
          carrierName: 'Maersk Line',
          dockId: 'Dock A',
          slotTime: '2026-11-01T10:00:00Z',
          status: 'CONFIRMED',
          confirmationId: 'WH-CONF-DOCKA-123456',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    ];

    const wb = generateEnrichedWorkbook(mockEnriched);
    expect(wb.SheetNames).toContain('Enriched Manifest');
    const sheet = wb.Sheets['Enriched Manifest'];
    const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];
    expect(rows.length).toBe(1);
    expect(rows[0]['Shipment ID']).toBe('SH-EXP-1');
    expect(rows[0]['Current Status']).toBe('IN_TRANSIT');
    expect(rows[0]['Booking Confirmation ID']).toBe('WH-CONF-DOCKA-123456');
    expect(rows[0]['Location Accuracy']).toBe('PORT_APPROXIMATE');
  });

  it('parses sample-aggregator-manifest.xlsx with all 7 aggregator and third-party logistics test IDs', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.resolve(process.cwd(), 'sample-aggregator-manifest.xlsx');
    const buffer = fs.readFileSync(filePath);

    const summary = parseSpreadsheetBuffer(buffer, 'sample-aggregator-manifest.xlsx');
    expect(summary.totalRows).toBe(7);
    expect(summary.validRows).toBe(7);
    expect(summary.errorRows).toBe(0);

    const carriers = summary.rows.map((r) => r.carrier);
    expect(carriers).toEqual([
      'fedex',
      'ups',
      'usps',
      'dhl',
      'bluedart',
      'amazon-shipping',
      'tpc',
    ]);
  });
});
