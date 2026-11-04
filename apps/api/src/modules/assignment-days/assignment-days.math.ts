import { DAY_STATUS, type DayStatus } from '@ap/shared-constants';
import { addDaysIST, diffDaysIST, todayIST } from '../../shared/time/index.js';

/**
 * Calculates window rent in paise pro-rated for window duration:
 * round half-up: (rentPer30DaysPaise * windowDays + 15) / 30
 */
export function calculateWindowRent(rentPer30DaysPaise: number, windowDays: number): number {
  if (windowDays <= 0 || rentPer30DaysPaise <= 0) return 0;
  const rent = BigInt(rentPer30DaysPaise);
  const days = BigInt(windowDays);
  return Number((rent * days + 15n) / 30n);
}

/**
 * Pure function: Estimates rent earned so far based on payable days.
 * Formula: floor(windowRentPaise / windowDays * payableDays)
 */
export function estimateRentSoFar(
  windowRentPaise: number,
  windowDays: number,
  payableDays: number,
): number {
  if (windowDays <= 0 || payableDays <= 0 || windowRentPaise <= 0) return 0;
  const rent = BigInt(windowRentPaise);
  const days = BigInt(windowDays);
  const payable = BigInt(payableDays);
  return Number((rent * payable) / days);
}

/**
 * Pure function: Projects final rent payout after deducting unexcused missed days past grace limit.
 * cutDays = max(0, missedDays - graceDays)
 * projected = floor(windowRentPaise * (windowDays - cutDays) / windowDays)
 */
export function projectFinalRent(
  windowRentPaise: number,
  windowDays: number,
  missedDays: number,
  graceDays: number = 3,
): number {
  if (windowDays <= 0 || windowRentPaise <= 0) return 0;
  const cutDays = Math.max(0, missedDays - graceDays);
  const payableDaysProjected = Math.max(0, windowDays - cutDays);
  const rent = BigInt(windowRentPaise);
  const days = BigInt(windowDays);
  const proj = BigInt(payableDaysProjected);
  return Number((rent * proj) / days);
}

/**
 * Determines the cutoff Date (in UTC) for an IST day date string (YYYY-MM-DD):
 * End of that IST date (23:59:59.999 IST = 18:29:59.999 UTC) + lateGraceHours.
 */
export function getDayCutoffUtc(istDate: string, lateGraceHours: number = 12): Date {
  // istDate is YYYY-MM-DD. End of IST day is YYYY-MM-DDT18:29:59.999Z
  // Adding lateGraceHours to 18:30:00
  const endOfIstDayMs = new Date(`${istDate}T18:29:59.999Z`).getTime();
  return new Date(endOfIstDayMs + lateGraceHours * 3600 * 1000);
}

/**
 * Checks whether an IST day date has passed its submission cutoff time.
 */
export function isDayCutoffPassed(
  istDate: string,
  nowUtc: Date = new Date(),
  lateGraceHours: number = 12,
): boolean {
  const cutoff = getDayCutoffUtc(istDate, lateGraceHours);
  return nowUtc.getTime() > cutoff.getTime();
}

/**
 * Pure function: Determines day status based on existing photo status, date, and cutoff.
 */
export function computeDayStatus(options: {
  currentStatus?: DayStatus;
  hasVerifiedPhoto: boolean;
  hasPhotoUnderReview: boolean;
  istDate: string;
  nowUtc?: Date;
  lateGraceHours?: number;
}): DayStatus {
  // If already excused or verified, preserve final state
  if (options.currentStatus === DAY_STATUS.EXCUSED) {
    return DAY_STATUS.EXCUSED;
  }
  if (options.hasVerifiedPhoto || options.currentStatus === DAY_STATUS.VERIFIED) {
    return DAY_STATUS.VERIFIED;
  }
  if (options.hasPhotoUnderReview || options.currentStatus === DAY_STATUS.UNDER_REVIEW) {
    return DAY_STATUS.UNDER_REVIEW;
  }

  // Check if cutoff has passed
  const cutoffPassed = isDayCutoffPassed(
    options.istDate,
    options.nowUtc ?? new Date(),
    options.lateGraceHours ?? 12,
  );

  if (cutoffPassed) {
    return DAY_STATUS.MISSED;
  }

  return DAY_STATUS.PENDING;
}

