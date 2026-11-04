import { describe, it, expect } from 'vitest';
import {
  calculateWindowRent,
  estimateRentSoFar,
  projectFinalRent,
  computeDayStatus,
  getDayCutoffUtc,
  isDayCutoffPassed,
} from '../assignment-days.math.js';
import { DAY_STATUS } from '@ap/shared-constants';

describe('Assignment Days Math and Spec Calculations', () => {
  describe('Rent projection spec cases (30 day window, rent 100,000 paise, 3 grace days)', () => {
    const rentPer30Days = 100000;
    const windowDays = 30;
    const windowRent = calculateWindowRent(rentPer30Days, windowDays);

    it('30 verified days (0 missed) -> 100,000 paise', () => {
      const projected = projectFinalRent(windowRent, windowDays, 0, 3);
      expect(projected).toBe(100000);

      const estimated = estimateRentSoFar(windowRent, windowDays, 30);
      expect(estimated).toBe(100000);
    });

    it('27 verified days (3 missed, 3 grace) -> 100,000 paise', () => {
      const projected = projectFinalRent(windowRent, windowDays, 3, 3);
      expect(projected).toBe(100000);

      const estimated = estimateRentSoFar(windowRent, windowDays, 27);
      expect(estimated).toBe(90000); // 27/30 * 100000
    });

    it('24 verified days (6 missed, 3 grace, 3 cut) -> 90,000 paise', () => {
      const projected = projectFinalRent(windowRent, windowDays, 6, 3);
      expect(projected).toBe(90000);

      const estimated = estimateRentSoFar(windowRent, windowDays, 24);
      expect(estimated).toBe(80000);
    });

    it('15 verified days (15 missed, 3 grace, 12 cut) -> 60,000 paise', () => {
      const projected = projectFinalRent(windowRent, windowDays, 15, 3);
      expect(projected).toBe(60000);

      const estimated = estimateRentSoFar(windowRent, windowDays, 15);
      expect(estimated).toBe(50000);
    });
  });

  describe('Day cutoff and status computation', () => {
    const istDate = '2026-11-05';
    // End of 2026-11-05 IST is 2026-11-05T18:29:59.999Z
    // With 12h grace, cutoff is 2026-11-06T06:29:59.999Z

    it('calculates cutoff accurately', () => {
      const cutoff = getDayCutoffUtc(istDate, 12);
      expect(cutoff.toISOString()).toBe('2026-11-06T06:29:59.999Z');
    });

    it('within grace window -> PENDING', () => {
      const now = new Date('2026-11-06T05:00:00.000Z');
      expect(isDayCutoffPassed(istDate, now, 12)).toBe(false);

      const status = computeDayStatus({
        hasVerifiedPhoto: false,
        hasPhotoUnderReview: false,
        istDate,
        nowUtc: now,
        lateGraceHours: 12,
      });
      expect(status).toBe(DAY_STATUS.PENDING);
    });

    it('after grace window has passed -> MISSED', () => {
      const now = new Date('2026-11-06T07:00:00.000Z');
      expect(isDayCutoffPassed(istDate, now, 12)).toBe(true);

      const status = computeDayStatus({
        hasVerifiedPhoto: false,
        hasPhotoUnderReview: false,
        istDate,
        nowUtc: now,
        lateGraceHours: 12,
      });
      expect(status).toBe(DAY_STATUS.MISSED);
    });

    it('photo under review stays UNDER_REVIEW even after cutoff', () => {
      const now = new Date('2026-11-06T09:00:00.000Z');
      const status = computeDayStatus({
        hasVerifiedPhoto: false,
        hasPhotoUnderReview: true,
        istDate,
        nowUtc: now,
        lateGraceHours: 12,
      });
      expect(status).toBe(DAY_STATUS.UNDER_REVIEW);
    });

    it('verified photo marks day as VERIFIED', () => {
      const status = computeDayStatus({
        hasVerifiedPhoto: true,
        hasPhotoUnderReview: false,
        istDate,
      });
      expect(status).toBe(DAY_STATUS.VERIFIED);
    });

    it('excused day stays EXCUSED', () => {
      const status = computeDayStatus({
        currentStatus: DAY_STATUS.EXCUSED,
        hasVerifiedPhoto: false,
        hasPhotoUnderReview: false,
        istDate,
      });
      expect(status).toBe(DAY_STATUS.EXCUSED);
    });
  });
});

