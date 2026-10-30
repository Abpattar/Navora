/* eslint-disable @typescript-eslint/no-require-imports */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const rows = [
  {
    'Shipment ID': 'SHP-FX-3988',
    'Tracking Number': '398891812948',
    'Carrier': 'FedEx',
    'Origin': 'Memphis Hub, US',
    'Destination': 'Los Angeles, US',
    'Promised Delivery': '2026-11-03 14:00:00',
    'Assigned Dock': 'Dock A',
    'Extraction Endpoint': 'https://www.track123.com/tracking/398891812948',
    'Extraction Advantage': 'Track123 Universal DOM: Clean DOM hierarchy & direct JSON responses without Cloudflare/Akamai stops'
  },
  {
    'Shipment ID': 'SHP-UP-1Z6R',
    'Tracking Number': '1Z6R42A40438792344',
    'Carrier': 'UPS',
    'Origin': 'Louisville Worldport, US',
    'Destination': 'Chicago O\'Hare, US',
    'Promised Delivery': '2026-11-04 10:00:00',
    'Assigned Dock': 'Dock B',
    'Extraction Endpoint': 'https://www.track123.com/tracking/1Z6R42A40438792344',
    'Extraction Advantage': 'Track123 UPS Gateway: Full event history rendered cleanly without browser-fingerprinting stops'
  },
  {
    'Shipment ID': 'SHP-US-9500',
    'Tracking Number': '9500109441760092147847',
    'Carrier': 'USPS',
    'Origin': 'New York JFK Distribution, US',
    'Destination': 'Dallas Postal Annex, US',
    'Promised Delivery': '2026-11-05 16:00:00',
    'Assigned Dock': 'Dock C',
    'Extraction Endpoint': 'https://www.track123.com/tracking/9500109441760092147847',
    'Extraction Advantage': 'Track123 USPS Gateway: Parses multi-stage scan checkpoints and facility timestamps directly'
  },
  {
    'Shipment ID': 'SHP-DH-3018',
    'Tracking Number': '30184465961',
    'Carrier': 'DHL Express',
    'Origin': 'Frankfurt CargoCity, DE',
    'Destination': 'Mumbai Air Cargo Complex, IN',
    'Promised Delivery': '2026-11-04 12:00:00',
    'Assigned Dock': 'Dock D',
    'Extraction Endpoint': 'https://www.track123.com/tracking/30184465961',
    'Extraction Advantage': 'Track123 DHL Express: Standard 10/11-digit AWB structure extracted with zero browser challenges'
  },
  {
    'Shipment ID': 'SHP-BD-1234',
    'Tracking Number': '12345678901',
    'Carrier': 'Blue Dart',
    'Origin': 'Delhi Cargo Terminal, IN',
    'Destination': 'Bangalore Hub, IN',
    'Promised Delivery': '2026-11-02 09:00:00',
    'Assigned Dock': 'Dock A',
    'Extraction Endpoint': 'https://www.bluedart.com/trackdartresultthirdparty',
    'Extraction Advantage': 'Blue Dart Third-Party Public: Renders static, server-side HTML tables without JavaScript hydration or complex tokens'
  },
  {
    'Shipment ID': 'SHP-AZ-1000',
    'Tracking Number': '100000000000',
    'Carrier': 'Amazon Shipping',
    'Origin': 'Bhiwandi FC, IN',
    'Destination': 'Hyderabad Logistics Center, IN',
    'Promised Delivery': '2026-11-03 11:00:00',
    'Assigned Dock': 'Dock B',
    'Extraction Endpoint': 'https://track.amazon.in/api/tracker/100000000000',
    'Extraction Advantage': 'Amazon Shipping India API: Direct unauthenticated internal API returning nested JSON (progressTracker, eventHistory)'
  },
  {
    'Shipment ID': 'SHP-TP-BLR1',
    'Tracking Number': 'BLR1234567',
    'Carrier': 'The Professional Couriers',
    'Origin': 'Chennai Central Office, IN',
    'Destination': 'Kochi Regional Hub, IN',
    'Promised Delivery': '2026-11-04 15:00:00',
    'Assigned Dock': 'Dock C',
    'Extraction Endpoint': 'https://www.tpcindia.com/TPCWebService/TrackMobDe.ashx?podno=BLR1234567',
    'Extraction Advantage': 'TPC Web Service: Raw plain text feed intended for mobile apps; bypasses main website CAPTCHA entirely'
  }
];

// Create workbook
const ws = XLSX.utils.json_to_sheet(rows, {
  header: [
    'Shipment ID',
    'Tracking Number',
    'Carrier',
    'Origin',
    'Destination',
    'Promised Delivery',
    'Assigned Dock',
    'Extraction Endpoint',
    'Extraction Advantage'
  ]
});

// Set column widths for readability
ws['!cols'] = [
  { wch: 14 }, // Shipment ID
  { wch: 24 }, // Tracking Number
  { wch: 25 }, // Carrier
  { wch: 28 }, // Origin
  { wch: 28 }, // Destination
  { wch: 20 }, // Promised Delivery
  { wch: 14 }, // Assigned Dock
  { wch: 48 }, // Extraction Endpoint
  { wch: 80 }, // Extraction Advantage
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Fast-Extract Manifest');

// File paths
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');

const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
const csvContent = XLSX.utils.sheet_to_csv(ws);

// Write to root
fs.writeFileSync(path.join(rootDir, 'sample-aggregator-manifest.xlsx'), xlsxBuffer);
fs.writeFileSync(path.join(rootDir, 'sample-aggregator-manifest.csv'), csvContent);

// Write to public/
fs.writeFileSync(path.join(publicDir, 'sample-aggregator-manifest.xlsx'), xlsxBuffer);
fs.writeFileSync(path.join(publicDir, 'sample-aggregator-manifest.csv'), csvContent);

console.log('Successfully generated sample-aggregator-manifest.xlsx and sample-aggregator-manifest.csv in root and public/');
