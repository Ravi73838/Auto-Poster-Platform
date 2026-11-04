// GENERATED FILE. DO NOT EDIT.
// Source: api/src/contract/money/index.ts
// Run `npm run sync:shared` in api.
// Global BigInt JSON serialization support
declare global {
  interface BigInt {
    toJSON(): string;
  }
}

if (!('toJSON' in BigInt.prototype)) {
  Object.defineProperty(BigInt.prototype, 'toJSON', {
    value: function (this: bigint): string {
      return this.toString();
    },
    writable: true,
    configurable: true,
  });
}

export interface CampaignPricingInput {
  targetAutoCount: number;
  days: number;
  dailyRentPaise?: number;
  rentPer30DaysPaise?: number;
  printingAllowancePaise: number;
  commissionRateBps: number;
  gstRateBps: number;
}


export interface CampaignPricingResult {
  driverRentTotalPaise: bigint;
  driverPrintingTotalPaise: bigint;
  totalBudgetPaise: bigint;
  platformFeePaise: bigint;
  gstAmountPaise: bigint;
  totalChargedPaise: bigint;
}

/**
 * Pure function to calculate campaign pricing and taxes.
 * Uses integer paise exclusively. Divisions round half-up.
 */
export function calculateCampaignPricing(
  input: CampaignPricingInput,
): CampaignPricingResult {
  if (input.targetAutoCount <= 0) {
    throw new Error('targetAutoCount must be greater than 0');
  }
  if (input.days <= 0) {
    throw new Error('days must be greater than 0');
  }
  if (input.dailyRentPaise !== undefined && input.dailyRentPaise < 0) {
    throw new Error('dailyRentPaise cannot be negative');
  }
  if (input.rentPer30DaysPaise !== undefined && input.rentPer30DaysPaise < 0) {
    throw new Error('rentPer30DaysPaise cannot be negative');
  }
  if (input.dailyRentPaise === undefined && input.rentPer30DaysPaise === undefined) {
    throw new Error('Either dailyRentPaise or rentPer30DaysPaise must be provided');
  }
  if (input.printingAllowancePaise < 0) {
    throw new Error('printingAllowancePaise cannot be negative');
  }
  if (input.commissionRateBps < 0 || input.commissionRateBps > 10000) {
    throw new Error('commissionRateBps must be between 0 and 10000');
  }
  if (input.gstRateBps < 0 || input.gstRateBps > 10000) {
    throw new Error('gstRateBps must be between 0 and 10000');
  }

  const autos = BigInt(input.targetAutoCount);
  const days = BigInt(input.days);
  const printing = BigInt(input.printingAllowancePaise);
  const commissionBps = BigInt(input.commissionRateBps);
  const gstBps = BigInt(input.gstRateBps);

  let driverRentTotalPaise: bigint;
  if (input.rentPer30DaysPaise !== undefined) {
    const rentPer30Days = BigInt(input.rentPer30DaysPaise);
    // round half-up: (rentPer30Days * days + 15) / 30
    const rentPerAutoPaise = (rentPer30Days * days + 15n) / 30n;
    driverRentTotalPaise = autos * rentPerAutoPaise;
  } else {
    const dailyRent = BigInt(input.dailyRentPaise ?? 0);
    driverRentTotalPaise = autos * days * dailyRent;
  }

  const driverPrintingTotalPaise = autos * printing;
  const totalBudgetPaise = driverRentTotalPaise + driverPrintingTotalPaise;


  // Round half-up on division: (n * bps + 5000) / 10000
  const platformFeePaise = (driverRentTotalPaise * commissionBps + 5000n) / 10000n;
  const gstAmountPaise = (platformFeePaise * gstBps + 5000n) / 10000n;
  const totalChargedPaise = totalBudgetPaise + platformFeePaise + gstAmountPaise;

  return {
    driverRentTotalPaise,
    driverPrintingTotalPaise,
    totalBudgetPaise,
    platformFeePaise,
    gstAmountPaise,
    totalChargedPaise,
  };
}

export interface RentPayoutInput {
  dailyRentPaise: number;
  verifiedDays: number;
}

/**
 * Pure function to calculate rent payout for verified days.
 */
export function calculateRentPayout(input: RentPayoutInput): bigint {
  if (input.dailyRentPaise < 0) {
    throw new Error('dailyRentPaise cannot be negative');
  }
  if (input.verifiedDays < 0) {
    throw new Error('verifiedDays cannot be negative');
  }

  return BigInt(input.dailyRentPaise) * BigInt(input.verifiedDays);
}

export const toRupees = (paise: bigint | number) => Money.paiseToRupees(paise);

export const Money = {
  /**
   * Convert paise (integer/bigint) to rupees decimal string (e.g. 50050 -> "500.50").
   */
  paiseToRupees(paise: bigint | number): string {
    const p = BigInt(paise);
    const isNegative = p < 0n;
    const abs = isNegative ? -p : p;
    const rupees = abs / 100n;
    const remainingPaise = abs % 100n;
    const formatted = `${rupees.toString()}.${remainingPaise.toString().padStart(2, '0')}`;
    return isNegative ? `-${formatted}` : formatted;
  },

  /**
   * Convert rupees (number or string) to integer paise.
   */
  rupeesToPaise(rupees: number | string): bigint {
    const str = typeof rupees === 'number' ? rupees.toFixed(2) : rupees.trim();
    const parts = str.split('.');
    const whole = parts[0] ? BigInt(parts[0]) : 0n;
    const frac = parts[1] ? parts[1].padEnd(2, '0').slice(0, 2) : '00';
    const isNegative = whole < 0n || str.startsWith('-');
    const fracBig = BigInt(frac);
    const absPaise = (isNegative ? -whole : whole) * 100n + fracBig;
    return isNegative ? -absPaise : absPaise;
  },

  /**
   * Format paise as Indian Rupee currency string (e.g. "₹500.00").
   */
  format(
    paise: bigint | number,
    options?: { locale?: string; currency?: string },
  ): string {
    const locale = options?.locale ?? 'en-IN';
    const currency = options?.currency ?? 'INR';
    const rupeesNum = Number(paise) / 100;
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(rupeesNum);
  },
};

/**
 * Format paise string or number/bigint as an Indian Rupee currency string (e.g. "₹500.00").
 */
export function formatINR(paise?: string | bigint | number | null): string {
  if (paise === undefined || paise === null || paise === '') {
    return '₹0.00';
  }
  const p = typeof paise === 'string' ? BigInt(paise || '0') : BigInt(paise);
  return Money.format(p);
}
