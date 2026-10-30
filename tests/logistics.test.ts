import { describe, expect, it } from 'vitest';
import { calculateEtaComparison, parseIsoOrDate } from '@/lib/logistics/eta-calculator';
import { assessSlaRisk } from '@/lib/logistics/sla-detector';
import { calculateDemurrageAndDetention } from '@/lib/logistics/demurrage-calculator';
import { calculateEquipmentDetention } from '@/lib/logistics/detention-calculator';
import { evaluateShipmentRisk } from '@/lib/logistics/risk-engine';

describe('Logistics Intelligence - ETA & Timezones', () => {
  it('correctly calculates positive difference for delayed shipments', () => {
    const promised = '2026-11-01T10:00:00Z';
    const live = '2026-11-02T10:00:00Z'; // exactly +24 hours
    const result = calculateEtaComparison(promised, live);

    expect(result.isValid).toBe(true);
    expect(result.differenceHours).toBe(24);
    expect(result.differenceDays).toBe(1);
    expect(result.classification).toBe('LATE');
  });

  it('handles negative difference for early vessels', () => {
    const promised = '2026-11-05T18:00:00Z';
    const live = '2026-11-05T06:00:00Z'; // 12 hours early
    const result = calculateEtaComparison(promised, live);

    expect(result.isValid).toBe(true);
    expect(result.differenceHours).toBe(-12);
    expect(result.classification).toBe('EARLY');
  });

  it('classifies within 2 hours as ON_TIME', () => {
    const promised = '2026-11-01T12:00:00Z';
    const live = '2026-11-01T13:00:00Z'; // +1 hour difference
    const result = calculateEtaComparison(promised, live);

    expect(result.isValid).toBe(true);
    expect(result.classification).toBe('ON_TIME');
  });

  it('handles timezone offsets accurately', () => {
    const promised = '2026-11-01T12:00:00+05:30'; // 06:30 UTC
    const live = '2026-11-01T06:30:00Z'; // 06:30 UTC
    const result = calculateEtaComparison(promised, live);

    expect(result.isValid).toBe(true);
    expect(result.differenceHours).toBe(0);
    expect(result.classification).toBe('ON_TIME');
  });

  it('returns UNKNOWN classification if ETA is missing or unparseable', () => {
    const result = calculateEtaComparison('Invalid Date', null);
    expect(result.isValid).toBe(false);
    expect(result.classification).toBe('UNKNOWN');
  });
});

describe('Logistics Intelligence - SLA & Exceptions', () => {
  it('detects SLA breaches for overruns exceeding 24 hours', () => {
    const risk = assessSlaRisk('2026-11-01T10:00:00Z', '2026-11-02T16:00:00Z');
    expect(risk.isBreached).toBe(true);
    expect(risk.riskLevel).toBe('HIGH');
    expect(risk.delayHours).toBe(30);
  });

  it('flags CRITICAL risk for severe delivery delays over 72 hours', () => {
    const risk = assessSlaRisk('2026-11-01T10:00:00Z', '2026-11-05T10:00:00Z');
    expect(risk.isBreached).toBe(true);
    expect(risk.riskLevel).toBe('CRITICAL');
  });

  it('identifies customs hold exceptions regardless of ETA', () => {
    const risk = assessSlaRisk('2026-11-01T10:00:00Z', '2026-11-01T10:00:00Z', 'CUSTOMS_HOLD');
    expect(risk.isBreached).toBe(true);
    expect(risk.riskLevel).toBe('HIGH');
    expect(risk.reason).toContain('Customs hold in effect');
  });
});

describe('Logistics Intelligence - Demurrage & Detention', () => {
  it('calculates demurrage correctly based on configurable carrier rate table', () => {
    const now = new Date();
    // 3 days overdue past last free date
    const lastFreeDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const estimate = calculateDemurrageAndDetention({
      status: 'ARRIVED_AT_TERMINAL',
      carrier: 'maersk',
      lastFreeDate,
    });

    expect(estimate.daysOverdue).toBe(3);
    expect(estimate.dailyRate).toBe(120); // Maersk default USD 120/day
    expect(estimate.estimatedDemurrage).toBe(360);
    expect(estimate.currency).toBe('USD');
  });

  it('applies port-specific rate overrides transparently', () => {
    const now = new Date();
    const lastFreeDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

    const estimate = calculateDemurrageAndDetention({
      status: 'ARRIVED_AT_TERMINAL',
      carrier: 'maersk',
      port: 'Nhava Sheva',
      lastFreeDate,
    });

    expect(estimate.dailyRate).toBe(4500); // Nhava Sheva override INR 4500
    expect(estimate.currency).toBe('INR');
    expect(estimate.estimatedDemurrage).toBe(9000);
  });

  it('calculates equipment detention when empty return is overdue', () => {
    const dischargeDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const detention = calculateEquipmentDetention({
      dischargeDate,
      carrierFreeDays: 7,
      dailyDetentionRate: 90,
    });

    expect(detention.isOverdue).toBe(true);
    expect(detention.daysExceeded).toBe(3); // 10 - 7 = 3 days overdue
    expect(detention.detentionFee).toBe(270);
  });
});

describe('Logistics Intelligence - Risk Engine', () => {
  it('computes composite risk score and appropriate severity', () => {
    const risk = evaluateShipmentRisk({
      sla: {
        isBreached: true,
        isAtRisk: false,
        riskLevel: 'CRITICAL',
        delayHours: 80,
        delayDays: 3.3,
        reason: 'Severe delay',
        classification: 'LATE',
      },
      status: 'DELAYED',
    });

    expect(risk.riskScore).toBeGreaterThanOrEqual(50);
    expect(risk.severity).toBe('HIGH');
    expect(risk.recommendedUrgency).toBe('IMMEDIATE');
  });
});
