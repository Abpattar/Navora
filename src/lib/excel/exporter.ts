import * as XLSX from 'xlsx';
import type { EnrichedShipment } from '@/lib/types';

export function generateEnrichedWorkbook(shipments: EnrichedShipment[]): XLSX.WorkBook {
  const data = shipments.map(({ shipment, tracking, sla, demurrage, booking, rescheduleAction }) => {
    return {
      'Shipment ID': shipment.shipmentId,
      'Tracking / Container No': shipment.trackingNumber,
      'Carrier': shipment.carrierName,
      'Origin': shipment.origin || 'Not specified',
      'Destination': shipment.destination || 'Not specified',
      'Promised ETA': shipment.promisedEta ? new Date(shipment.promisedEta).toLocaleString() : 'N/A',
      'Assigned Dock': shipment.assignedDock || 'Unassigned',
      // Enriched Tracking fields
      'Current Status': tracking?.currentStatus || 'UNKNOWN',
      'Current Location': tracking?.currentLocation || 'Pending carrier update',
      'Live ETA': tracking?.liveEta ? new Date(tracking.liveEta).toLocaleString() : 'N/A',
      'ETA Difference': sla ? (sla.delayHours > 0 ? `+${sla.delayHours} hrs` : `${sla.delayHours} hrs`) : 'N/A',
      'SLA Risk': sla ? `${sla.riskLevel} (${sla.reason})` : 'NONE',
      'Estimated Demurrage': demurrage ? `${demurrage.currency} ${demurrage.estimatedDemurrage}` : '$0',
      'Estimated Detention': demurrage ? `${demurrage.currency} ${demurrage.estimatedDetention}` : '$0',
      'Total Financial Exposure': demurrage ? `${demurrage.currency} ${demurrage.totalExposure}` : '$0',
      'Agent Lookup Status': tracking?.lookupStatus || 'pending',
      'Retrieved At': tracking?.retrievedAt ? new Date(tracking.retrievedAt).toLocaleString() : 'Not retrieved',
      'Location Accuracy': 'PORT_APPROXIMATE',
      // Warehouse action fields
      'Warehouse Rescheduling Status': rescheduleAction?.status || (booking ? 'CONFIRMED' : 'NO_BOOKING'),
      'New Dock Slot': rescheduleAction?.recommendedSlotTime
        ? new Date(rescheduleAction.recommendedSlotTime).toLocaleString()
        : (booking?.slotTime ? new Date(booking.slotTime).toLocaleString() : 'N/A'),
      'Booking Confirmation ID': rescheduleAction?.confirmationId || booking?.confirmationId || 'N/A',
      'Carrier Source URL': tracking?.sourceUrl || '',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(data);

  // Set column widths
  const colWidths = [
    { wch: 15 }, // Shipment ID
    { wch: 22 }, // Tracking No
    { wch: 24 }, // Carrier
    { wch: 18 }, // Origin
    { wch: 18 }, // Destination
    { wch: 22 }, // Promised ETA
    { wch: 16 }, // Assigned Dock
    { wch: 18 }, // Current Status
    { wch: 24 }, // Current Location
    { wch: 22 }, // Live ETA
    { wch: 18 }, // ETA Difference
    { wch: 30 }, // SLA Risk
    { wch: 20 }, // Est Demurrage
    { wch: 20 }, // Est Detention
    { wch: 24 }, // Total Exposure
    { wch: 18 }, // Lookup Status
    { wch: 22 }, // Retrieved At
    { wch: 18 }, // Location Accuracy
    { wch: 28 }, // Rescheduling Status
    { wch: 22 }, // New Dock Slot
    { wch: 26 }, // Confirmation ID
    { wch: 35 }, // Source URL
  ];
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Enriched Manifest');

  return workbook;
}

export function exportEnrichedExcelBuffer(shipments: EnrichedShipment[]): Uint8Array {
  const workbook = generateEnrichedWorkbook(shipments);
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
}

export function exportEnrichedCsvString(shipments: EnrichedShipment[]): string {
  const workbook = generateEnrichedWorkbook(shipments);
  const firstSheet = workbook.SheetNames[0];
  return XLSX.utils.sheet_to_csv(workbook.Sheets[firstSheet]);
}
