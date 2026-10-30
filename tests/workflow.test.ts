import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveShipment,
  saveTrackingObservation,
  createDockBooking,
  getShipment,
  getDockBookingByShipment,
  getShipmentWorkflow,
} from '@/lib/db';
import { executeShipmentWorkflow, approveAndExecuteWorkflow } from '@/lib/workflow/shipment-workflow';
import type { Shipment, ShipmentTracking, DockBooking } from '@/lib/types';

describe('Central Autonomous Shipment Workflow', () => {
  let testShipmentId = '';
  let shipment: Shipment;
  let initialBooking: DockBooking;

  beforeEach(() => {
    const uniq = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    testShipmentId = `ship-wf-${uniq}`;

    shipment = {
      id: testShipmentId,
      shipmentId: `SH-WF-${uniq}`,
      trackingNumber: `MSKU-${uniq}`,
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

    initialBooking = {
      id: `book-orig-${uniq}`,
      shipmentId: testShipmentId,
      trackingNumber: shipment.trackingNumber,
      carrierName: shipment.carrierName,
      dockId: 'Dock A',
      slotTime: '2026-11-01T10:00:00.000Z',
      status: 'CONFIRMED',
      confirmationId: `WH-CONF-DOCKA-${uniq}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveShipment(shipment);
    createDockBooking(initialBooking);
  });

  it('completes with on-schedule status if no transit delay is detected', async () => {
    // Save fresh observation that is on time
    const onTimeTracking: ShipmentTracking = {
      id: crypto.randomUUID(),
      shipmentId: testShipmentId,
      trackingNumber: shipment.trackingNumber,
      carrier: 'maersk',
      carrierName: 'Maersk Line',
      lookupStatus: 'success',
      currentStatus: 'IN_TRANSIT',
      rawStatus: 'On Schedule',
      currentLocation: 'Pacific Ocean',
      liveEta: '2026-11-01T10:00:00.000Z', // matches promised ETA
      isDelayed: false,
      sourceUrl: 'https://www.maersk.com/tracking',
      retrievedAt: new Date().toISOString(),
      milestones: [],
      warnings: [],
    };
    saveTrackingObservation(onTimeTracking);

    const result = await executeShipmentWorkflow(testShipmentId, { skipTrackingIfFreshMinutes: 60 });

    expect(result.workflow.currentState).toBe('COMPLETED');
    expect(result.workflow.status).toBe('COMPLETED');
    expect(result.message).toContain('on schedule');
  });

  it('detects delay, generates berth recommendation, and pauses at approval gate', async () => {
    // Save observation with 24-hour delay
    const delayedTracking: ShipmentTracking = {
      id: crypto.randomUUID(),
      shipmentId: testShipmentId,
      trackingNumber: shipment.trackingNumber,
      carrier: 'maersk',
      carrierName: 'Maersk Line',
      lookupStatus: 'success',
      currentStatus: 'DELAYED',
      rawStatus: 'Vessel Delayed by Weather',
      currentLocation: 'Pacific Ocean',
      liveEta: '2026-11-02T10:00:00.000Z', // +24 hours
      isDelayed: true,
      sourceUrl: 'https://www.maersk.com/tracking',
      retrievedAt: new Date().toISOString(),
      milestones: [],
      warnings: ['Carrier reported transit delay'],
    };
    saveTrackingObservation(delayedTracking);

    const result = await executeShipmentWorkflow(testShipmentId, { skipTrackingIfFreshMinutes: 60 });

    expect(result.workflow.currentState).toBe('APPROVAL_REQUIRED');
    expect(result.workflow.status).toBe('AWAITING_APPROVAL');
    expect(result.recommendation).toBeDefined();
    expect(result.workflow.proposedDock || result.workflow.recommendedDockId).toBeDefined();
    expect(result.workflow.proposedSlot || result.workflow.recommendedSlotTime).toBeDefined();
    expect(result.message).toContain('Awaiting human gatekeeper approval');
  });

  it('executes TinyFish WRITE agent upon human approval with atomic failsafe', async () => {
    // Delayed tracking
    const delayedTracking: ShipmentTracking = {
      id: crypto.randomUUID(),
      shipmentId: testShipmentId,
      trackingNumber: shipment.trackingNumber,
      carrier: 'maersk',
      carrierName: 'Maersk Line',
      lookupStatus: 'success',
      currentStatus: 'DELAYED',
      rawStatus: 'Delayed',
      currentLocation: 'Pacific Ocean',
      liveEta: '2026-11-02T10:00:00.000Z',
      isDelayed: true,
      sourceUrl: 'https://www.maersk.com/tracking',
      retrievedAt: new Date().toISOString(),
      milestones: [],
      warnings: [],
    };
    saveTrackingObservation(delayedTracking);

    // Run first 3 phases: READ -> DETECT -> DECIDE
    await executeShipmentWorkflow(testShipmentId, { skipTrackingIfFreshMinutes: 60 });

    // Step 4 & 5: APPROVE & WRITE
    const approved = await approveAndExecuteWorkflow(testShipmentId, 'Gatekeeper approved test');

    expect(approved.workflow.currentState).toBe('COMPLETED');
    expect(approved.workflow.status).toBe('COMPLETED');
    expect(approved.workflow.confirmationId).toMatch(/^WH-CONF-[A-Z0-9-]+$/i);

    // Verify Atomic Safety Failsafe in Database:
    // 1. Newly created replacement booking is CONFIRMED
    const activeBooking = getDockBookingByShipment(testShipmentId);
    expect(activeBooking).not.toBeNull();
    expect(activeBooking?.confirmationId).toBe(approved.workflow.confirmationId);
    expect(activeBooking?.status).toBe('CONFIRMED');

    // 2. Shipment table record has updated dock
    const updatedShipment = getShipment(testShipmentId);
    expect(updatedShipment?.assignedDock).toBe(activeBooking?.dockId);
  });
});
