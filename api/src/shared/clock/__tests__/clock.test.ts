import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { clock } from '../index.js';
import { env } from '../../../config/env.js';

describe('AppClock', () => {
  const originalEnv = { ...env };

  beforeEach(async () => {
    vi.restoreAllMocks();
    (env as any).DB_ENVIRONMENT = 'development';
    await clock.reset();
  });

  afterEach(async () => {
    await clock.reset();
    Object.assign(env, originalEnv);
  });

  it('defaults to current real time when offset is 0', () => {
    const before = Date.now();
    const clockNow = clock.now().getTime();
    const after = Date.now();

    expect(clockNow).toBeGreaterThanOrEqual(before);
    expect(clockNow).toBeLessThanOrEqual(after);
    expect(clock.isShifted()).toBe(false);
    expect(clock.getOffsetMs()).toBe(0);
  });

  it('advances time by specified offset in development', async () => {
    const oneDayMs = 24 * 60 * 60 * 1000;
    await clock.advance(oneDayMs);

    expect(clock.getOffsetMs()).toBe(oneDayMs);
    expect(clock.isShifted()).toBe(true);

    const realNow = Date.now();
    const clockNow = clock.now().getTime();
    expect(clockNow - realNow).toBeGreaterThanOrEqual(oneDayMs - 100);
    expect(clockNow - realNow).toBeLessThanOrEqual(oneDayMs + 1000);
  });

  it('resets back to real time', async () => {
    await clock.advance(3600000);
    expect(clock.isShifted()).toBe(true);

    await clock.reset();
    expect(clock.isShifted()).toBe(false);
    expect(clock.getOffsetMs()).toBe(0);
  });

  it('strictly prohibits clock modification in production', async () => {
    (env as any).DB_ENVIRONMENT = 'production';

    await expect(clock.advance(1000)).rejects.toThrow('prohibited in production');
    expect(clock.getOffsetMs()).toBe(0);
    expect(clock.isShifted()).toBe(false);
  });

  it('formats dates accurately for Asia/Kolkata timezone', () => {
    const utcDate = new Date('2026-11-08T00:30:00.000Z'); // 06:00 IST on Nov 8
    expect(clock.todayIst(utcDate)).toBe('2026-11-08');
  });
});

