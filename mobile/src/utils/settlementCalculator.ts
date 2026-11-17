/**
 * Driver campaign earnings & settlement calculation.
 * A standard 30-day campaign grants up to 3 allowable grace/missed days.
 * Payout formula:
 *   effectiveDays = min(totalDays, verifiedDays + graceAllowance)
 *   payablePaise = floor((effectiveDays / totalDays) * totalPaise)
 *
 * Spec cases for 30-day campaign with 100,000 paise pool:
 *   - 30 verified days -> min(30, 33) / 30 = 100,000 paise (100%)
 *   - 27 verified days -> min(30, 30) / 30 = 100,000 paise (100%)
 *   - 24 verified days -> min(30, 27) / 30 = 90,000 paise (90%)
 *   - 15 verified days -> min(30, 18) / 30 = 60,000 paise (60%)
 */

export interface SettlementProjectionInput {
  totalPaise: number;
  totalDays: number;
  verifiedDays: number;
  graceAllowanceDays?: number;
}

export function calculateDriverEarningsProjection(input: SettlementProjectionInput): {
  payablePaise: number;
  percentage: number;
  effectiveDays: number;
  graceDaysApplied: number;
} {
  const { totalPaise, totalDays, verifiedDays, graceAllowanceDays = 3 } = input;

  if (totalDays <= 0) {
    return { payablePaise: 0, percentage: 0, effectiveDays: 0, graceDaysApplied: 0 };
  }

  const effectiveDays = Math.min(totalDays, verifiedDays + graceAllowanceDays);
  const graceDaysApplied = Math.max(0, effectiveDays - verifiedDays);
  const payablePaise = Math.floor((effectiveDays / totalDays) * totalPaise);
  const percentage = Math.round((payablePaise / totalPaise) * 100);

  return {
    payablePaise,
    percentage,
    effectiveDays,
    graceDaysApplied,
  };
}

/**
 * Format Indian Rupees with proper comma grouping and currency symbol.
 * Example: 100000 paise -> ₹1,000.00
 */
export function formatPaiseToINR(paise: number | bigint): string {
  const p = Number(paise);
  const isNegative = p < 0;
  const abs = Math.abs(p);
  const rupees = Math.floor(abs / 100);
  const rem = abs % 100;

  // Indian number grouping for rupees (last 3, then groups of 2)
  const rupeesStr = rupees.toString();
  let lastThree = rupeesStr.substring(rupeesStr.length - 3);
  const otherNumbers = rupeesStr.substring(0, rupeesStr.length - 3);
  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }
  const formattedRupees = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;
  const formattedPaise = rem.toString().padStart(2, '0');

  return `${isNegative ? '-' : ''}₹${formattedRupees}.${formattedPaise}`;
}
