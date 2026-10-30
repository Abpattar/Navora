import { parseIsoOrDate } from './eta-calculator';

export interface DetentionCalculationInput {
  dischargeDate?: string | null;
  gateOutDate?: string | null;
  emptyReturnDate?: string | null;
  carrierFreeDays?: number;
  dailyDetentionRate?: number;
  currency?: string;
}

export interface DetentionResult {
  freeDaysAllowed: number;
  freeDaysExpiry: string | null;
  daysExceeded: number;
  detentionFee: number;
  currency: string;
  isOverdue: boolean;
  statusText: string;
}

export function calculateEquipmentDetention(input: DetentionCalculationInput): DetentionResult {
  const freeDays = input.carrierFreeDays ?? 7;
  const dailyRate = input.dailyDetentionRate ?? 90;
  const currency = input.currency ?? 'USD';

  const startDate = parseIsoOrDate(input.gateOutDate) || parseIsoOrDate(input.dischargeDate);
  if (!startDate) {
    return {
      freeDaysAllowed: freeDays,
      freeDaysExpiry: null,
      daysExceeded: 0,
      detentionFee: 0,
      currency,
      isOverdue: false,
      statusText: 'Gate-out / discharge date pending',
    };
  }

  const expiryMs = startDate.getTime() + freeDays * 24 * 60 * 60 * 1000;
  const expiryDate = new Date(expiryMs);

  const returnDate = parseIsoOrDate(input.emptyReturnDate) || new Date();
  const daysFraction = (returnDate.getTime() - expiryMs) / (24 * 60 * 60 * 1000);
  const diffDays = Math.ceil(daysFraction - 0.001);
  const daysExceeded = Math.max(0, diffDays);
  const detentionFee = daysExceeded * dailyRate;

  return {
    freeDaysAllowed: freeDays,
    freeDaysExpiry: expiryDate.toISOString(),
    daysExceeded,
    detentionFee,
    currency,
    isOverdue: daysExceeded > 0,
    statusText: daysExceeded > 0
      ? `${daysExceeded} days detention past allowed equipment return window`
      : `Equipment within ${freeDays} days return allowance`,
  };
}
