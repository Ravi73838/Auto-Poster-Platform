import { describe, it, expect } from 'vitest';
import {
  calculateDriverEarningsProjection,
  formatPaiseToINR,
} from '../utils/settlementCalculator';

describe('Layer 1 Data Correctness: Calculations & Money Formatting', () => {
  it('Spec Case 1: 30 verified days of a 100,000 paise window pays 100,000 paise (100%)', () => {
    const res = calculateDriverEarningsProjection({
      totalPaise: 100000,
      totalDays: 30,
      verifiedDays: 30,
    });

    expect(res.payablePaise).toBe(100000);
    expect(res.percentage).toBe(100);
    expect(res.effectiveDays).toBe(30);
  });

  it('Spec Case 2: 27 verified days of a 100,000 paise window pays 100,000 paise (grace applied)', () => {
    const res = calculateDriverEarningsProjection({
      totalPaise: 100000,
      totalDays: 30,
      verifiedDays: 27,
      graceAllowanceDays: 3,
    });

    expect(res.payablePaise).toBe(100000);
    expect(res.percentage).toBe(100);
    expect(res.effectiveDays).toBe(30);
    expect(res.graceDaysApplied).toBe(3);
  });

  it('Spec Case 3: 24 verified days of a 100,000 paise window pays 90,000 paise (90%)', () => {
    const res = calculateDriverEarningsProjection({
      totalPaise: 100000,
      totalDays: 30,
      verifiedDays: 24,
      graceAllowanceDays: 3,
    });

    expect(res.payablePaise).toBe(90000);
    expect(res.percentage).toBe(90);
    expect(res.effectiveDays).toBe(27);
    expect(res.graceDaysApplied).toBe(3);
  });

  it('Spec Case 4: 15 verified days of a 100,000 paise window pays 60,000 paise (60%)', () => {
    const res = calculateDriverEarningsProjection({
      totalPaise: 100000,
      totalDays: 30,
      verifiedDays: 15,
      graceAllowanceDays: 3,
    });

    expect(res.payablePaise).toBe(60000);
    expect(res.percentage).toBe(60);
    expect(res.effectiveDays).toBe(18);
    expect(res.graceDaysApplied).toBe(3);
  });

  it('Money Formatting: Formats paise with ₹ symbol and Indian comma grouping', () => {
    expect(formatPaiseToINR(0)).toBe('₹0.00');
    expect(formatPaiseToINR(100000)).toBe('₹1,000.00');
    expect(formatPaiseToINR(6930000)).toBe('₹69,300.00');
    expect(formatPaiseToINR(12500050)).toBe('₹1,25,000.50');
    expect(formatPaiseToINR(-50000)).toBe('-₹500.00');
  });
});
