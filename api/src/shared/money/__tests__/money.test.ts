import { describe, it, expect } from 'vitest';
import {
  calculateCampaignPricing,
  calculateRentPayout,
  Money,
} from '../index.js';

describe('shared/money', () => {
  describe('calculateCampaignPricing', () => {
    it('calculates campaign pricing correctly with round half-up division', () => {
      // 5 autos, 30 days, 100 INR (10000 paise) daily rent, 500 INR (50000 paise) printing allowance
      // 15% commission (1500 bps), 18% GST (1800 bps)
      const result = calculateCampaignPricing({
        targetAutoCount: 5,
        days: 30,
        dailyRentPaise: 10000,
        printingAllowancePaise: 50000,
        commissionRateBps: 1500,
        gstRateBps: 1800,
      });

      // 5 autos * 30 days * 10000 paise = 1,500,000 paise (15,000 INR)
      expect(result.driverRentTotalPaise).toBe(1500000n);

      // 5 autos * 50000 paise = 250,000 paise (2,500 INR)
      expect(result.driverPrintingTotalPaise).toBe(250000n);

      // Total Budget = 1,500,000 + 250,000 = 1,750,000 paise
      expect(result.totalBudgetPaise).toBe(1750000n);

      // Platform fee = round(1,500,000 * 1500 / 10000) = 225,000 paise
      expect(result.platformFeePaise).toBe(225000n);

      // GST = round(225,000 * 1800 / 10000) = 40,500 paise
      expect(result.gstAmountPaise).toBe(40500n);

      // Total charged = 1,750,000 + 225,000 + 40,500 = 2,015,500 paise (20,155 INR)
      expect(result.totalChargedPaise).toBe(2015500n);
    });

    it('calculates pricing for Phase 5 spec worked example (6930000 paise)', () => {
      // 50 autos, 30 days, rent 100000 paise per 30 days, allowance 15000 paise, commission 2000 bps, GST 1800 bps
      const result = calculateCampaignPricing({
        targetAutoCount: 50,
        days: 30,
        rentPer30DaysPaise: 100000,
        printingAllowancePaise: 15000,
        commissionRateBps: 2000,
        gstRateBps: 1800,
      });

      expect(result.driverRentTotalPaise).toBe(5000000n);
      expect(result.driverPrintingTotalPaise).toBe(750000n);
      expect(result.totalBudgetPaise).toBe(5750000n);
      expect(result.platformFeePaise).toBe(1000000n);
      expect(result.gstAmountPaise).toBe(180000n);
      expect(result.totalChargedPaise).toBe(6930000n);
    });

    it('rounds half-up accurately on odd amounts', () => {

      // 1 auto, 1 day, 333 paise, 0 printing, 1500 bps (15%)
      // 333 * 1500 = 499500 -> (499500 + 5000) / 10000 = 504500 / 10000 = 50n
      const result = calculateCampaignPricing({
        targetAutoCount: 1,
        days: 1,
        dailyRentPaise: 333,
        printingAllowancePaise: 0,
        commissionRateBps: 1500,
        gstRateBps: 1800,
      });

      expect(result.driverRentTotalPaise).toBe(333n);
      expect(result.platformFeePaise).toBe(50n);
      // 50 * 1800 = 90000 -> (90000 + 5000) / 10000 = 9n
      expect(result.gstAmountPaise).toBe(9n);
      expect(result.totalChargedPaise).toBe(333n + 50n + 9n);
    });

    it('throws on invalid inputs', () => {
      expect(() =>
        calculateCampaignPricing({
          targetAutoCount: 0,
          days: 10,
          dailyRentPaise: 100,
          printingAllowancePaise: 100,
          commissionRateBps: 1500,
          gstRateBps: 1800,
        }),
      ).toThrow('targetAutoCount must be greater than 0');

      expect(() =>
        calculateCampaignPricing({
          targetAutoCount: 5,
          days: -1,
          dailyRentPaise: 100,
          printingAllowancePaise: 100,
          commissionRateBps: 1500,
          gstRateBps: 1800,
        }),
      ).toThrow('days must be greater than 0');

      expect(() =>
        calculateCampaignPricing({
          targetAutoCount: 5,
          days: 10,
          dailyRentPaise: 100,
          printingAllowancePaise: 100,
          commissionRateBps: 15000,
          gstRateBps: 1800,
        }),
      ).toThrow('commissionRateBps must be between 0 and 10000');
    });
  });

  describe('calculateRentPayout', () => {
    it('calculates rent payout correctly', () => {
      const rent = calculateRentPayout({
        dailyRentPaise: 10000,
        verifiedDays: 25,
      });
      expect(rent).toBe(250000n);
    });

    it('returns 0 when 0 days verified', () => {
      const rent = calculateRentPayout({
        dailyRentPaise: 10000,
        verifiedDays: 0,
      });
      expect(rent).toBe(0n);
    });
  });

  describe('Money formatting & conversion', () => {
    it('converts paise to rupees decimal string', () => {
      expect(Money.paiseToRupees(50000n)).toBe('500.00');
      expect(Money.paiseToRupees(50050n)).toBe('500.50');
      expect(Money.paiseToRupees(5n)).toBe('0.05');
      expect(Money.paiseToRupees(0n)).toBe('0.00');
      expect(Money.paiseToRupees(-15025n)).toBe('-150.25');
    });

    it('converts rupees string/number to paise bigint', () => {
      expect(Money.rupeesToPaise('500.00')).toBe(50000n);
      expect(Money.rupeesToPaise('500.5')).toBe(50050n);
      expect(Money.rupeesToPaise(500.25)).toBe(50025n);
      expect(Money.rupeesToPaise('0.05')).toBe(5n);
      expect(Money.rupeesToPaise('-150.25')).toBe(-15025n);
    });

    it('formats paise as Indian Rupee currency string', () => {
      const formatted = Money.format(50000n);
      expect(formatted).toContain('500');
    });

    it('serializes BigInt safely with JSON.stringify', () => {
      const payload = {
        amountPaise: 100000000000n,
        title: 'Campaign Funding',
      };
      const json = JSON.stringify(payload);
      expect(json).toBe('{"amountPaise":"100000000000","title":"Campaign Funding"}');
    });
  });
});
