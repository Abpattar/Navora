export interface EtaComparisonResult {
  isValid: boolean;
  differenceHours: number;
  differenceDays: number;
  classification: 'EARLY' | 'ON_TIME' | 'LATE' | 'UNKNOWN';
  promisedDate: Date | null;
  liveDate: Date | null;
  formattedDifference: string;
}

export function parseIsoOrDate(dateString: string | null | undefined): Date | null {
  if (!dateString) return null;
  const trimmed = dateString.trim();
  if (!trimmed || /^(unknown|unavailable|n\/a|null|none)$/i.test(trimmed)) return null;

  const timestamp = Date.parse(trimmed);
  if (Number.isNaN(timestamp)) {
    // Try parsing common formats like DD/MM/YYYY or YYYY-MM-DD HH:mm
    const parts = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (parts) {
      const year = Number(parts[1]);
      const month = Number(parts[2]) - 1;
      const day = Number(parts[3]);
      const hour = parts[4] ? Number(parts[4]) : 0;
      const min = parts[5] ? Number(parts[5]) : 0;
      const sec = parts[6] ? Number(parts[6]) : 0;
      const parsed = new Date(Date.UTC(year, month, day, hour, min, sec));
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  }

  return new Date(timestamp);
}

export function calculateEtaComparison(
  promisedEta: string | null | undefined,
  liveEta: string | null | undefined
): EtaComparisonResult {
  const promisedDate = parseIsoOrDate(promisedEta);
  const liveDate = parseIsoOrDate(liveEta);

  if (!promisedDate || !liveDate) {
    return {
      isValid: false,
      differenceHours: 0,
      differenceDays: 0,
      classification: 'UNKNOWN',
      promisedDate,
      liveDate,
      formattedDifference: 'No ETA comparison possible',
    };
  }

  // difference = live - promised. Positive means delayed (arriving later). Negative means early.
  const diffMs = liveDate.getTime() - promisedDate.getTime();
  const diffHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
  const diffDays = Math.round((diffMs / (1000 * 60 * 60 * 24)) * 10) / 10;

  // Threshold: within 2 hours is considered on-time
  let classification: 'EARLY' | 'ON_TIME' | 'LATE' = 'ON_TIME';
  if (diffHours > 2) {
    classification = 'LATE';
  } else if (diffHours < -2) {
    classification = 'EARLY';
  }

  let formattedDifference: string;
  if (Math.abs(diffHours) < 1) {
    formattedDifference = 'On schedule';
  } else if (diffHours > 0) {
    formattedDifference = diffHours >= 24
      ? `+${diffDays} days delay`
      : `+${diffHours} hrs delay`;
  } else {
    const absHours = Math.abs(diffHours);
    const absDays = Math.abs(diffDays);
    formattedDifference = absHours >= 24
      ? `-${absDays} days early`
      : `-${absHours} hrs early`;
  }

  return {
    isValid: true,
    differenceHours: diffHours,
    differenceDays: diffDays,
    classification,
    promisedDate,
    liveDate,
    formattedDifference,
  };
}
