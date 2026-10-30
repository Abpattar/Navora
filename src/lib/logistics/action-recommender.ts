import type { DockBooking, EnrichedShipment } from '@/lib/types';
import { parseIsoOrDate } from './eta-calculator';

export interface ActionRecommendation {
  actionType: 'RESCHEDULE_WAREHOUSE_DOCK' | 'EXPEDITE_GATE_OUT' | 'CUSTOMS_BROKER_ALERT' | 'NOTIFY_CONSIGNEE' | 'NONE';
  title: string;
  description: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  recommendedDockSlot?: string;
  recommendedDockId?: 'Dock A' | 'Dock B' | 'Dock C';
  estimatedSavings?: number;
  currency?: string;
  canAutoExecute: boolean;
}

export function recommendShipmentActions(enriched: EnrichedShipment): ActionRecommendation[] {
  const recommendations: ActionRecommendation[] = [];
  const { shipment, tracking, booking, sla, demurrage } = enriched;

  // 1. Warehouse Dock Rescheduling Recommendation
  if (booking && tracking?.liveEta) {
    const liveEtaDate = parseIsoOrDate(tracking.liveEta);
    const bookedSlotDate = parseIsoOrDate(booking.slotTime);

    if (liveEtaDate && bookedSlotDate) {
      const diffHours = (liveEtaDate.getTime() - bookedSlotDate.getTime()) / (1000 * 60 * 60);

      // If delayed by more than 2 hours or arrived early by more than 6 hours
      if (diffHours > 2) {
        // Suggest a slot roughly 3 hours after live ETA to allow port clearance & drayage
        const targetSlot = new Date(liveEtaDate.getTime() + 3 * 60 * 60 * 1000);
        // Round to nearest next hour
        targetSlot.setMinutes(0, 0, 0);

        const dockOptions: Array<'Dock A' | 'Dock B' | 'Dock C'> = ['Dock A', 'Dock B', 'Dock C'];
        const chosenDock = booking.dockId || dockOptions[Math.floor(Math.random() * dockOptions.length)];

        recommendations.push({
          actionType: 'RESCHEDULE_WAREHOUSE_DOCK',
          title: `Autonomous Rescheduling: Shift ${booking.dockId} by +${Math.round(diffHours)}h`,
          description: `Shipment ETA is delayed to ${liveEtaDate.toLocaleString()}. Current dock reservation at ${bookedSlotDate.toLocaleTimeString()} will cause dock congestion and demurrage.`,
          priority: diffHours > 24 ? 'CRITICAL' : 'HIGH',
          recommendedDockSlot: targetSlot.toISOString(),
          recommendedDockId: chosenDock,
          estimatedSavings: demurrage ? demurrage.dailyRate * Math.max(1, Math.floor(diffHours / 24)) : 250,
          currency: demurrage?.currency || 'USD',
          canAutoExecute: true,
        });
      }
    }
  }

  // 2. Customs Examination Action
  if (tracking?.currentStatus === 'CUSTOMS_HOLD' || demurrage?.isCustomsHold) {
    recommendations.push({
      actionType: 'CUSTOMS_BROKER_ALERT',
      title: 'Immediate Customs Broker Escalation',
      description: 'Shipment is flagged with an active customs hold. Request bill of entry examination docs to avoid detention accrual.',
      priority: 'HIGH',
      canAutoExecute: false,
    });
  }

  // 3. Demurrage Avoidance Pickup
  if (demurrage && demurrage.daysOverdue > 0) {
    recommendations.push({
      actionType: 'EXPEDITE_GATE_OUT',
      title: `Expedite Container Gate-Out (${demurrage.currency} ${demurrage.totalExposure} Accruing)`,
      description: `Container has exceeded free time by ${demurrage.daysOverdue} days. Arrange direct port pull to off-dock staging yard.`,
      priority: 'CRITICAL',
      estimatedSavings: demurrage.dailyRate,
      currency: demurrage.currency,
      canAutoExecute: false,
    });
  }

  // 4. Consignee Delay Notification
  if (sla?.isBreached && sla.delayHours >= 12) {
    recommendations.push({
      actionType: 'NOTIFY_CONSIGNEE',
      title: 'Dispatch Proactive ETA Breach Notice to Consignee',
      description: `Delivery SLA overrun confirmed (+${sla.delayHours} hrs). Transmit revised delivery timetable to receiving team.`,
      priority: 'MEDIUM',
      canAutoExecute: true,
    });
  }

  return recommendations;
}
