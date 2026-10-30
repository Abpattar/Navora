import type { DockBooking, DockId, Shipment, SlotRecommendation } from '@/lib/types';
import { listDockBookings } from '@/lib/db';
import { parseIsoOrDate } from '@/lib/logistics/eta-calculator';

export const ALL_DOCKS: DockId[] = ['Dock A', 'Dock B', 'Dock C', 'Dock D'];
export const OPERATING_HOURS = [8, 10, 12, 14, 16]; // 2-hour slots: 08:00, 10:00, 12:00, 14:00, 16:00 (ends 18:00)

export interface RescheduleDecisionInput {
  shipment: Shipment;
  revisedEtaIso?: string | null;
  activeBookings?: DockBooking[];
  preferredBufferHours?: number; // default 4 hours after arrival
}

/**
 * Evaluates warehouse berth capacity, revised vessel ETA, and buffer times
 * to compute the optimal dock slot recommendation.
 */
export function evaluateRescheduleDecision(input: RescheduleDecisionInput): SlotRecommendation {
  const { shipment, preferredBufferHours = 4 } = input;
  const activeBookings = input.activeBookings || listDockBookings().filter((b) => b.status === 'CONFIRMED');

  const originalDockId: DockId = (shipment.assignedDock as DockId) || 'Dock A';
  const originalSlotTime = shipment.assignedDockSlot || shipment.promisedEta || new Date().toISOString();

  // Determine target arrival
  const etaStr = input.revisedEtaIso || (shipment as unknown as { liveEta?: string }).liveEta || shipment.promisedEta || new Date().toISOString();
  const parsedEta = parseIsoOrDate(etaStr) || new Date();

  // Earliest possible slot time = arrival + buffer
  const earliestTargetMs = parsedEta.getTime() + preferredBufferHours * 60 * 60 * 1000;
  const earliestTargetDate = new Date(earliestTargetMs);

  // Build candidate slots starting from earliestTargetDate for next 5 days
  const candidateSlots: Array<{ dockId: DockId; slotDate: Date }> = [];
  const checkDate = new Date(earliestTargetDate);
  checkDate.setMinutes(0, 0, 0);

  // If before 08:00 on the day, start at 08:00. If after 16:00, advance to tomorrow 08:00
  for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
    const currentDay = new Date(checkDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const yyyy = currentDay.getFullYear();
    const mm = currentDay.getMonth();
    const dd = currentDay.getDate();

    for (const hour of OPERATING_HOURS) {
      const slotTime = new Date(yyyy, mm, dd, hour, 0, 0);
      if (slotTime.getTime() >= earliestTargetMs) {
        // Evaluate all docks in preference order: same dock first, then others
        const sortedDocks = [...ALL_DOCKS].sort((a, b) => {
          if (a === originalDockId) return -1;
          if (b === originalDockId) return 1;
          return a.localeCompare(b);
        });

        for (const dock of sortedDocks) {
          candidateSlots.push({ dockId: dock, slotDate: slotTime });
        }
      }
    }
  }

  // Find non-conflicting slots by checking active bookings
  const isBooked = (dockId: DockId, date: Date) => {
    return activeBookings.some((b) => {
      if (b.dockId !== dockId) return false;
      if (b.status !== 'CONFIRMED') return false;
      if (b.shipmentId === shipment.id) return false; // same shipment can be rescheduled
      const bDate = parseIsoOrDate(b.slotTime);
      if (!bDate) return false;
      // Match within the 2-hour window
      return Math.abs(bDate.getTime() - date.getTime()) < 110 * 60 * 1000;
    });
  };

  const availableSlots: Array<{ dockId: DockId; slotDate: Date }> = [];
  for (const candidate of candidateSlots) {
    if (!isBooked(candidate.dockId, candidate.slotDate)) {
      availableSlots.push(candidate);
    }
  }

  // Fallback if full: pick earliest slot even if crowded
  const primary = availableSlots[0] || candidateSlots[0] || {
    dockId: originalDockId,
    slotDate: new Date(earliestTargetMs),
  };

  const alternatives = availableSlots.slice(1, 4).map((alt) => ({
    dockId: alt.dockId,
    slotTime: alt.slotDate.toISOString(),
    reason: alt.dockId === originalDockId ? 'Same berth, next opening' : 'Cross-berth immediate capacity',
  }));

  // Calculate delay in minutes between original slot and proposed slot
  const origDate = parseIsoOrDate(originalSlotTime) || new Date();
  const delayMinutes = Math.round((primary.slotDate.getTime() - origDate.getTime()) / (60 * 1000));

  // Demurrage risk calculation
  let demurrageRisk: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' = 'NONE';
  const lastFreeDate = (shipment as unknown as { lastFreeDate?: string }).lastFreeDate;
  if (lastFreeDate) {
    const lfd = parseIsoOrDate(lastFreeDate);
    if (lfd) {
      const diffHours = (primary.slotDate.getTime() - lfd.getTime()) / (60 * 60 * 1000);
      if (diffHours > 24) demurrageRisk = 'HIGH';
      else if (diffHours > 0) demurrageRisk = 'MEDIUM';
      else if (diffHours > -24) demurrageRisk = 'LOW';
    }
  } else if (delayMinutes > 2880) {
    demurrageRisk = 'MEDIUM';
  }

  const reasoning = [
    `Revised ETA (${parsedEta.toLocaleDateString()} ${parsedEta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}) requires +${preferredBufferHours}h vessel discharge & drayage buffer.`,
    `Optimal slot ${primary.dockId} at ${primary.slotDate.toLocaleDateString()} ${primary.slotDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} avoids berth collision.`,
    delayMinutes > 0 ? `Adjusts schedule by +${Math.round(delayMinutes / 60)} hours to prevent gate detention.` : 'Slot remains on-schedule.',
    demurrageRisk !== 'NONE' ? `Demurrage risk assessed as ${demurrageRisk}.` : 'Zero demurrage risk within free-time window.',
  ].join(' ');

  return {
    dockId: primary.dockId,
    slotTime: primary.slotDate.toISOString(),
    reason: reasoning,
    bufferHours: preferredBufferHours,
    arrivalEta: parsedEta.toISOString(),
    confidence: 'CONFIRMED',
    durationHours: 2,
    conflictDetected: false,
    shipmentId: shipment.id,
    trackingNumber: shipment.trackingNumber,
    originalDockId,
    originalSlotTime,
    recommendedDockId: primary.dockId,
    recommendedSlotTime: primary.slotDate.toISOString(),
    delayMinutes,
    reasoning,
    alternativeSlots: alternatives,
    demurrageRisk,
  };
}
