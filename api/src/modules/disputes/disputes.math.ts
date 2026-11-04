import { getISTTime } from '../notifications/notifications.helpers.js';

/**
 * Adds business days (Monday-Friday) in IST timezone and sets target time to 18:00 IST.
 */
export function addBusinessDaysIST(startDate: Date = new Date(), businessDays: number = 3): Date {
  const { year, month, day } = getISTTime(startDate);

  let current = new Date(Date.UTC(year, month - 1, day, 12, 30, 0)); // 18:00 IST is 12:30 UTC
  let added = 0;

  while (added < businessDays) {
    current.setUTCDate(current.getUTCDate() + 1);
    const dayOfWeek = current.getUTCDay();
    // 0 is Sunday, 6 is Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      added++;
    }
  }

  return current;
}

/**
 * Calculates money hold amount (in paise) for an assignment based on dispute reason.
 */
export function calculateHoldAmount(params: {
  reason: string;
  assignment?: {
    totalDays: number;
    campaign?: {
      dailyRentPaise?: bigint | number;
      printingAllowancePaise?: bigint | number;
    };
  } | null;
  claimedPaise?: bigint;
}): bigint {
  if (params.claimedPaise && params.claimedPaise > 0n) {
    return params.claimedPaise;
  }

  const campaign = params.assignment?.campaign;
  if (!campaign) {
    return 0n;
  }

  const dailyRent = BigInt(campaign.dailyRentPaise ?? 0);
  const printingAllowance = BigInt(campaign.printingAllowancePaise ?? 0);

  switch (params.reason) {
    case 'PHOTO_WRONGLY_REJECTED':
      // 1 day's rent held
      return dailyRent;

    case 'INSTALL_WRONGLY_REJECTED':
      // Printing allowance held
      return printingAllowance;

    case 'SETTLEMENT_AMOUNT':
    case 'PAYMENT_ISSUE':
    case 'WRONGFUL_TERMINATION':
      // Hold up to 3 days of rent or total remaining rent
      return dailyRent * 3n;

    default:
      return 0n;
  }
}

