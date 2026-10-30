import { describe, expect, it } from 'vitest';
import {
  createDockBooking,
  getDockBookingByShipment,
  listDockBookings,
  saveShipment,
  updateDockBookingStatus,
} from '@/lib/db';
import type { DockBooking, Shipment } from '@/lib/types';

describe('Warehouse Portal & Rescheduling Safety', () => {
  it('creates and persists dock reservations with unique confirmation keys', () => {
    const shipmentId = `s-test-${Date.now()}`;
    const confId = `WH-CONF-TEST-${Math.floor(100000 + Math.random() * 900000)}`;

    const booking: DockBooking = {
      id: crypto.randomUUID(),
      shipmentId,
      trackingNumber: 'TEST123456',
      carrierName: 'Maersk Line',
      dockId: 'Dock A',
      slotTime: new Date().toISOString(),
      status: 'CONFIRMED',
      confirmationId: confId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    createDockBooking(booking);

    const retrieved = getDockBookingByShipment(shipmentId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.confirmationId).toBe(confId);
    expect(retrieved?.dockId).toBe('Dock A');
    expect(retrieved?.status).toBe('CONFIRMED');
  });

  it('safely handles replacement reservations: confirms replacement before transitioning prior', () => {
    const shipmentId = `s-resched-${Date.now()}`;
    const origConf = `WH-CONF-ORIG-${Date.now()}`;
    const origBooking: DockBooking = {
      id: crypto.randomUUID(),
      shipmentId,
      trackingNumber: 'RESCHED99',
      carrierName: 'MSC',
      dockId: 'Dock A',
      slotTime: '2026-11-01T10:00:00Z',
      status: 'CONFIRMED',
      confirmationId: origConf,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    createDockBooking(origBooking);

    // Replacement booking is created and confirmed first
    const replacementConf = `WH-CONF-REPL-${Date.now()}`;
    const replBooking: DockBooking = {
      id: crypto.randomUUID(),
      shipmentId,
      trackingNumber: 'RESCHED99',
      carrierName: 'MSC',
      dockId: 'Dock B',
      slotTime: '2026-11-01T14:00:00Z',
      status: 'CONFIRMED',
      confirmationId: replacementConf,
      originalBookingId: origBooking.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    createDockBooking(replBooking);

    // Only after replacement is confirmed, original is marked RESCHEDULED
    updateDockBookingStatus(origBooking.id, 'RESCHEDULED');

    // The active booking for this shipment is now the replacement
    const active = getDockBookingByShipment(shipmentId);
    expect(active?.confirmationId).toBe(replacementConf);
    expect(active?.dockId).toBe('Dock B');
    expect(active?.status).toBe('CONFIRMED');
  });
});
