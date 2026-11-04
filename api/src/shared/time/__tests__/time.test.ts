import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  todayIST,
  toISTDate,
  startOfISTDay,
  endOfISTDay,
  addDaysIST,
  diffDaysIST,
  TimeService,
  type Clock,
} from '../index.js';

describe('IST Time Helpers', () => {
  afterEach(() => {
    TimeService.resetClock();
  });

  it('converts dates to IST date string YYYY-MM-DD correctly', () => {
    // 2026-10-30 18:29:59 UTC is 23:59:59 IST on 2026-10-30
    const beforeMidnight = new Date('2026-10-30T18:29:59.000Z');
    expect(toISTDate(beforeMidnight)).toBe('2026-10-30');

    // 2026-10-30 18:30:00 UTC is 00:00:00 IST on 2026-10-31
    const atMidnight = new Date('2026-10-30T18:30:00.000Z');
    expect(toISTDate(atMidnight)).toBe('2026-10-31');
  });

  it('uses injectable Clock for todayIST()', () => {
    const fakeClock: Clock = {
      now: () => new Date('2026-12-31T18:29:00.000Z'), // 23:59 IST on Dec 31, 2026
    };
    TimeService.setClock(fakeClock);
    expect(todayIST()).toBe('2026-12-31');

    const fakeClockNewYear: Clock = {
      now: () => new Date('2026-12-31T18:31:00.000Z'), // 00:01 IST on Jan 1, 2027
    };
    TimeService.setClock(fakeClockNewYear);
    expect(todayIST()).toBe('2027-01-01');
  });

  it('calculates startOfISTDay and endOfISTDay correctly', () => {
    const start = startOfISTDay('2026-10-30');
    expect(start.toISOString()).toBe('2026-10-29T18:30:00.000Z');

    const end = endOfISTDay('2026-10-30');
    expect(end.toISOString()).toBe('2026-10-30T18:29:59.999Z');
  });

  it('handles addDaysIST across month and leap-year boundaries', () => {
    expect(addDaysIST('2026-10-30', 2)).toBe('2026-11-01');
    expect(addDaysIST('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysIST('2024-02-28', 1)).toBe('2024-02-29'); // Leap year
    expect(addDaysIST('2023-02-28', 1)).toBe('2023-03-01'); // Non-leap year
    expect(addDaysIST('2026-11-01', -2)).toBe('2026-10-30');
  });

  it('calculates diffDaysIST accurately', () => {
    expect(diffDaysIST('2026-10-01', '2026-10-31')).toBe(30);
    expect(diffDaysIST('2026-10-30', '2026-10-30')).toBe(0);
    expect(diffDaysIST('2026-10-30', '2026-11-14')).toBe(15);
    expect(diffDaysIST('2026-11-14', '2026-10-30')).toBe(-15);
  });
});
