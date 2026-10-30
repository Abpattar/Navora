import type { CarrierId, DemurrageEstimate, ShipmentStatus } from '@/lib/types';
import { parseIsoOrDate } from './eta-calculator';

export interface RateConfig {
  freeTimeDays: number;
  dailyRate: number;
  detentionDailyRate: number;
  currency: string;
}

export const DEFAULT_CARRIER_RATES: Record<string, RateConfig> = {
  'maersk': { freeTimeDays: 7, dailyRate: 120, detentionDailyRate: 90, currency: 'USD' },
  'msc': { freeTimeDays: 5, dailyRate: 130, detentionDailyRate: 95, currency: 'USD' },
  'cma-cgm': { freeTimeDays: 5, dailyRate: 125, detentionDailyRate: 90, currency: 'USD' },
  'hapag-lloyd': { freeTimeDays: 7, dailyRate: 115, detentionDailyRate: 85, currency: 'USD' },
  'cosco': { freeTimeDays: 7, dailyRate: 110, detentionDailyRate: 80, currency: 'USD' },
  'evergreen': { freeTimeDays: 6, dailyRate: 115, detentionDailyRate: 85, currency: 'USD' },
  'one': { freeTimeDays: 7, dailyRate: 120, detentionDailyRate: 85, currency: 'USD' },
  'oocl': { freeTimeDays: 7, dailyRate: 115, detentionDailyRate: 85, currency: 'USD' },
  'zim': { freeTimeDays: 5, dailyRate: 125, detentionDailyRate: 90, currency: 'USD' },
  'yang-ming': { freeTimeDays: 6, dailyRate: 110, detentionDailyRate: 80, currency: 'USD' },
  'ldb-india': { freeTimeDays: 4, dailyRate: 4000, detentionDailyRate: 2500, currency: 'INR' },
  'bluedart': { freeTimeDays: 2, dailyRate: 1500, detentionDailyRate: 1000, currency: 'INR' },
  'delhivery': { freeTimeDays: 2, dailyRate: 1200, detentionDailyRate: 800, currency: 'INR' },
  'tci-express': { freeTimeDays: 3, dailyRate: 1800, detentionDailyRate: 1200, currency: 'INR' },
  'v-xpress': { freeTimeDays: 3, dailyRate: 1600, detentionDailyRate: 1100, currency: 'INR' },
  'air-cargo': { freeTimeDays: 2, dailyRate: 65, detentionDailyRate: 40, currency: 'USD' },
};

export const PORT_RATE_OVERRIDES: Record<string, Partial<RateConfig>> = {
  'shanghai': { freeTimeDays: 4, dailyRate: 140 },
  'singapore': { freeTimeDays: 5, dailyRate: 135 },
  'nhava sheva': { freeTimeDays: 4, dailyRate: 4500, currency: 'INR' },
  'chennai': { freeTimeDays: 4, dailyRate: 4200, currency: 'INR' },
  'los angeles': { freeTimeDays: 4, dailyRate: 180 },
  'rotterdam': { freeTimeDays: 7, dailyRate: 110, currency: 'EUR' },
};

export interface DemurrageCalculationInput {
  status?: ShipmentStatus | string | null;
  liveEta?: string | null;
  lastFreeDate?: string | null;
  carrier?: CarrierId | string | null;
  port?: string | null;
  customFreeTimeDays?: number;
  customDailyRate?: number;
}

export function calculateDemurrageAndDetention(input: DemurrageCalculationInput): DemurrageEstimate {
  const carrierKey = (input.carrier || 'maersk').toLowerCase();
  const baseRate = DEFAULT_CARRIER_RATES[carrierKey] || {
    freeTimeDays: 5,
    dailyRate: 120,
    detentionDailyRate: 85,
    currency: 'USD',
  };

  let freeTimeDays = input.customFreeTimeDays ?? baseRate.freeTimeDays;
  let dailyRate = input.customDailyRate ?? baseRate.dailyRate;
  let currency = baseRate.currency;

  if (input.port) {
    const portKey = input.port.toLowerCase();
    for (const [key, override] of Object.entries(PORT_RATE_OVERRIDES)) {
      if (portKey.includes(key)) {
        if (override.freeTimeDays !== undefined && input.customFreeTimeDays === undefined) {
          freeTimeDays = override.freeTimeDays;
        }
        if (override.dailyRate !== undefined && input.customDailyRate === undefined) {
          dailyRate = override.dailyRate;
        }
        if (override.currency) {
          currency = override.currency;
        }
        break;
      }
    }
  }

  const now = new Date();
  let freeTimeExpiry: Date | null = null;
  let daysOverdue = 0;
  let detentionDaysOverdue = 0;

  // If carrier explicitly supplied lastFreeDate, use that authoritative source
  if (input.lastFreeDate) {
    const parsedLfd = parseIsoOrDate(input.lastFreeDate);
    if (parsedLfd) {
      freeTimeExpiry = parsedLfd;
    }
  }

  // Otherwise calculate freeTimeExpiry from liveEta + freeTimeDays if shipment arrived
  if (!freeTimeExpiry && input.liveEta) {
    const arrivalDate = parseIsoOrDate(input.liveEta);
    if (arrivalDate) {
      freeTimeExpiry = new Date(arrivalDate.getTime() + freeTimeDays * 24 * 60 * 60 * 1000);
    }
  }

  const isAtTerminalOrCustoms = input.status === 'ARRIVED_AT_TERMINAL' || input.status === 'CUSTOMS_HOLD';
  const isCustomsHold = input.status === 'CUSTOMS_HOLD';

  if (freeTimeExpiry) {
    const overdueMs = now.getTime() - freeTimeExpiry.getTime();
    if (overdueMs > 0 && isAtTerminalOrCustoms) {
      const daysFraction = overdueMs / (24 * 60 * 60 * 1000);
      daysOverdue = Math.max(0, Math.ceil(daysFraction - 0.001));
    }
  }

  // If container is held in customs beyond free time, additional detention applies
  if (isCustomsHold && daysOverdue > 3) {
    detentionDaysOverdue = daysOverdue - 3;
  }

  const estimatedDemurrage = daysOverdue * dailyRate;
  const estimatedDetention = detentionDaysOverdue * baseRate.detentionDailyRate;
  const totalExposure = estimatedDemurrage + estimatedDetention;

  const notes = daysOverdue > 0
    ? `${daysOverdue} days accrued past ${freeTimeDays}-day free window @ ${currency} ${dailyRate}/day`
    : `Within ${freeTimeDays}-day free time limit. Expiry: ${freeTimeExpiry ? freeTimeExpiry.toLocaleDateString() : 'Pending arrival'}`;

  return {
    freeTimeDays,
    freeTimeExpiry: freeTimeExpiry ? freeTimeExpiry.toISOString() : null,
    dailyRate,
    currency,
    daysOverdue,
    estimatedDemurrage,
    detentionDaysOverdue,
    estimatedDetention,
    totalExposure,
    isCustomsHold,
    notes,
  };
}
