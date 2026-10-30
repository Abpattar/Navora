import { describe, it, expect } from 'vitest';
import { evaluateRescheduleDecision, ALL_DOCKS, OPERATING_HOURS } from '@/lib/logistics/reschedule-decision-engine';
import type { DockBooking, Shipment } from '@/lib/types';

describe('Warehouse Reschedule Decision Engine', () => {
  const baseShipment: Shipment = {
    id: 'ship-test-01',
    shipmentId: 'SH-01',
    trackingNumber: 'MSKU9070323',
    carrier: 'maersk',
    carrierName: 'Maersk Line',
    origin: 'Shanghai',
    destination: 'Los Angeles',
    promisedEta: '2026-11-01T10:00:00.000Z',
    assignedDock: 'Dock A',
    assignedDockSlot: '2026-11-01T10:00:00.000Z',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('shifts slot past arrival time + buffer window', () => {
    // Vessel arrives 2026-11-02 at 08:00 (22 hours late)
    const revisedEta = '2026-11-02T08:00:00.000Z';
    const rec = evaluateRescheduleDecision({
      shipment: baseShipment,
      revisedEtaIso: revisedEta,
      activeBookings: [],
      preferredBufferHours: 4,
    });

    const recommendedDate = new Date(rec.recommendedSlotTime);
    const arrivalDate = new Date(revisedEta);

    // Recommended slot must be at least 4 hours after arrival
    expect(recommendedDate.getTime()).toBeGreaterThanOrEqual(arrivalDate.getTime() + 4 * 60 * 60 * 1000);
    // Must be in operating hours (08:00 to 16:00 start)
    expect(OPERATING_HOURS).toContain(recommendedDate.getHours());
    // Must assign a recognized dock
    expect(ALL_DOCKS).toContain(rec.recommendedDockId);
  });

  it('avoids dock conflict if original dock has confirmed collision', () => {
    const revisedEta = '2026-11-02T08:00:00.000Z';
    const conflictSlot = new Date('2026-11-02T12:00:00.000Z');

    // Dock A is already booked at 12:00
    const activeBooking: DockBooking = {
      id: 'book-conflict',
      shipmentId: 'other-shipment',
      trackingNumber: 'MEDU8456123',
      carrierName: 'MSC',
      dockId: 'Dock A',
      slotTime: conflictSlot.toISOString(),
      status: 'CONFIRMED',
      confirmationId: 'WH-CONF-DOCKA-999',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const rec = evaluateRescheduleDecision({
      shipment: baseShipment,
      revisedEtaIso: revisedEta,
      activeBookings: [activeBooking],
      preferredBufferHours: 4, // earliest target is 12:00
    });

    // Should choose another dock (Dock B, C, or D) or another time slot if Dock A at 12:00 is taken
    const slotIsDockAAt12 = rec.recommendedDockId === 'Dock A' && new Date(rec.recommendedSlotTime).getTime() === conflictSlot.getTime();
    expect(slotIsDockAAt12).toBe(false);
  });

  it('flags demurrage risk when slot slips past last free date', () => {
    const shipmentWithLfd: Shipment = {
      ...baseShipment,
      promisedEta: '2026-11-01T10:00:00.000Z',
      assignedDockSlot: '2026-11-01T10:00:00.000Z',
    };
    (shipmentWithLfd as any).lastFreeDate = '2026-11-02T00:00:00.000Z';

    const rec = evaluateRescheduleDecision({
      shipment: shipmentWithLfd,
      revisedEtaIso: '2026-11-03T10:00:00.000Z', // 2 days past free time
      activeBookings: [],
    });

    expect(['MEDIUM', 'HIGH']).toContain(rec.demurrageRisk);
    expect(rec.reasoning).toContain('Demurrage risk');
  });
});
