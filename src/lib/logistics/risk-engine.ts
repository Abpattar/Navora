import type { DemurrageEstimate, ShipmentStatus, SLARisk } from '@/lib/types';

export interface ShipmentRiskProfile {
  riskScore: number; // 0 (healthy) to 100 (critical)
  severity: 'HEALTHY' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  topRiskFactor: string;
  financialExposure: number;
  currency: string;
  recommendedUrgency: 'IMMEDIATE' | 'HIGH' | 'ROUTINE' | 'NONE';
}

export function evaluateShipmentRisk(params: {
  sla?: SLARisk;
  demurrage?: DemurrageEstimate;
  status?: ShipmentStatus | string | null;
}): ShipmentRiskProfile {
  const { sla, demurrage, status } = params;

  let score = 0;
  let topRisk = 'Shipment progressing normally';
  let urgency: ShipmentRiskProfile['recommendedUrgency'] = 'NONE';

  // SLA factor (up to 40 pts)
  if (sla?.isBreached) {
    if (sla.riskLevel === 'CRITICAL') {
      score += 40;
      topRisk = `Critical SLA breach: +${sla.delayDays} days delay`;
      urgency = 'IMMEDIATE';
    } else {
      score += 30;
      topRisk = `SLA breach: +${sla.delayHours} hrs delay`;
      urgency = 'HIGH';
    }
  } else if (sla?.isAtRisk) {
    score += 15;
    topRisk = `Potential SLA delay: +${sla.delayHours} hrs`;
    urgency = 'ROUTINE';
  }

  // Demurrage factor (up to 35 pts)
  if (demurrage && demurrage.daysOverdue > 0) {
    const overdueDays = demurrage.daysOverdue;
    const points = Math.min(35, overdueDays * 7);
    score += points;
    if (overdueDays >= 2) {
      topRisk = `Active demurrage penalty: ${demurrage.currency} ${demurrage.totalExposure} (${overdueDays} days)`;
      urgency = 'IMMEDIATE';
    }
  }

  // Customs hold factor (up to 25 pts)
  if (status === 'CUSTOMS_HOLD') {
    score += 25;
    topRisk = 'Active customs examination hold';
    urgency = 'IMMEDIATE';
  } else if (status === 'DELAYED') {
    score += 10;
  }

  score = Math.min(100, score);

  let severity: ShipmentRiskProfile['severity'] = 'HEALTHY';
  if (score >= 75) severity = 'CRITICAL';
  else if (score >= 50) severity = 'HIGH';
  else if (score >= 25) severity = 'MEDIUM';
  else if (score > 10) severity = 'LOW';

  return {
    riskScore: score,
    severity,
    topRiskFactor: topRisk,
    financialExposure: demurrage?.totalExposure ?? 0,
    currency: demurrage?.currency ?? 'USD',
    recommendedUrgency: urgency,
  };
}
