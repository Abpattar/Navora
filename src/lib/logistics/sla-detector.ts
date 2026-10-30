import { calculateEtaComparison } from './eta-calculator';
import type { ShipmentStatus, SLARisk } from '@/lib/types';

export function assessSlaRisk(
  promisedEta: string | null | undefined,
  liveEta: string | null | undefined,
  currentStatus?: ShipmentStatus | string | null,
  rawStatusText?: string | null
): SLARisk {
  const etaComparison = calculateEtaComparison(promisedEta, liveEta);
  const isCustomsHold = currentStatus === 'CUSTOMS_HOLD' ||
    Boolean(rawStatusText && /customs hold|customs inspection|clearance hold|held by customs/i.test(rawStatusText));

  const isShippingException = Boolean(
    rawStatusText && /rolled|missed connection|vessel discharge delay|port strike|terminal congestion/i.test(rawStatusText)
  );

  let isBreached = false;
  let isAtRisk = false;
  const reasons: string[] = [];
  const delayHours = etaComparison.isValid ? etaComparison.differenceHours : 0;

  if (isCustomsHold) {
    isBreached = true;
    reasons.push('Customs hold in effect at intermediate or destination terminal');
  }

  if (isShippingException) {
    isAtRisk = true;
    reasons.push('Carrier reported shipping exception or vessel connection rollover');
  }

  if (etaComparison.isValid) {
    if (delayHours > 24) {
      isBreached = true;
      reasons.push(delayHours > 72
        ? `Severe delivery overrun (+${etaComparison.differenceDays} days beyond agreed SLA)`
        : `Delivery SLA breached (+${etaComparison.differenceHours} hrs past promised window)`);
    } else if (delayHours > 6) {
      isAtRisk = true;
      reasons.push(`Likely dock arrival overrun (+${delayHours} hrs delay expected)`);
    } else if (delayHours > 2) {
      isAtRisk = true;
      reasons.push(`Minor transit delay (+${delayHours} hrs)`);
    } else if (etaComparison.classification === 'EARLY') {
      reasons.push(`Vessel running early (${etaComparison.formattedDifference})`);
    } else {
      reasons.push('Shipment on schedule');
    }
  } else if (!isCustomsHold && !isShippingException) {
    reasons.push('Promised or live ETA pending carrier update');
  }

  // Calculate severity
  let riskLevel: SLARisk['riskLevel'] = 'NONE';
  if (delayHours > 72) {
    riskLevel = 'CRITICAL';
  } else if (isCustomsHold || delayHours > 24) {
    riskLevel = 'HIGH';
  } else if (isShippingException || delayHours > 6) {
    riskLevel = 'MEDIUM';
  } else if (delayHours > 2) {
    riskLevel = 'LOW';
  }

  return {
    isBreached,
    isAtRisk,
    riskLevel,
    delayHours: etaComparison.differenceHours,
    delayDays: etaComparison.differenceDays,
    classification: etaComparison.classification,
    reason: reasons.join(' · '),
  };
}
