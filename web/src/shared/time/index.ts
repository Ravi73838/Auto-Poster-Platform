// GENERATED FILE. DO NOT EDIT.
// Source: api/src/contract/time/index.ts
// Run `npm run sync:shared` in api.
export interface Clock {
  now(): Date;
}

class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class TimeService {
  private static clock: Clock = new SystemClock();

  static setClock(customClock: Clock): void {
    this.clock = customClock;
  }

  static resetClock(): void {
    this.clock = new SystemClock();
  }

  static now(): Date {
    return this.clock.now();
  }
}

const IST_TIMEZONE = 'Asia/Kolkata';

// Intl formatter for YYYY-MM-DD in Asia/Kolkata
const istDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: IST_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Returns YYYY-MM-DD representing the current calendar date in Asia/Kolkata (IST).
 */
export function todayIST(): string {
  return toISTDate(TimeService.now());
}

/**
 * Converts a JavaScript Date to YYYY-MM-DD in Asia/Kolkata (IST).
 */
export function toISTDate(date: Date): string {
  return istDateFormatter.format(date);
}

/**
 * Parses YYYY-MM-DD into year, month, day components.
 */
function parseISTDateComponents(dateStr: string): { year: number; month: number; day: number } {
  const parts = dateStr.split('-');
  if (parts.length !== 3) {
    throw new Error(`Invalid IST date format, expected YYYY-MM-DD: ${dateStr}`);
  }
  const year = parseInt(parts[0]!, 10);
  const month = parseInt(parts[1]!, 10);
  const day = parseInt(parts[2]!, 10);
  return { year, month, day };
}

/**
 * Returns UTC Date corresponding to 00:00:00.000 on the given IST date.
 * E.g. '2026-10-30' -> 2026-10-29T18:30:00.000Z.
 */
export function startOfISTDay(dateOrStr: Date | string): Date {
  const dateStr = typeof dateOrStr === 'string' ? dateOrStr : toISTDate(dateOrStr);
  return new Date(`${dateStr}T00:00:00.000+05:30`);
}

/**
 * Returns UTC Date corresponding to 23:59:59.999 on the given IST date.
 * E.g. '2026-10-30' -> 2026-10-30T18:29:59.999Z.
 */
export function endOfISTDay(dateOrStr: Date | string): Date {
  const dateStr = typeof dateOrStr === 'string' ? dateOrStr : toISTDate(dateOrStr);
  return new Date(`${dateStr}T23:59:59.999+05:30`);
}

/**
 * Adds an integer number of days to an IST date (YYYY-MM-DD).
 */
export function addDaysIST(dateStr: string, days: number): string {
  const { year, month, day } = parseISTDateComponents(dateStr);
  // UTC Date avoids local daylight saving issues
  const utcDate = new Date(Date.UTC(year, month - 1, day + days));
  const y = utcDate.getUTCFullYear();
  const m = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utcDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calculates calendar day difference between start and end IST dates (end - start).
 * E.g. diffDaysIST('2026-10-01', '2026-10-31') = 30.
 */
export function diffDaysIST(startDateStr: string, endDateStr: string): number {
  const start = parseISTDateComponents(startDateStr);
  const end = parseISTDateComponents(endDateStr);

  const startUtc = Date.UTC(start.year, start.month - 1, start.day);
  const endUtc = Date.UTC(end.year, end.month - 1, end.day);

  return Math.round((endUtc - startUtc) / (1000 * 60 * 60 * 24));
}
