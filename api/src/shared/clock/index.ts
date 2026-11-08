import { getRedisClient } from '../redis/index.js';
import { env } from '../../config/env.js';
import { logger } from '../logger/index.js';

const CLOCK_OFFSET_REDIS_KEY = 'app:clock:offset_ms';

async function safeRedisOp<T>(op: () => Promise<T>, fallback: T): Promise<T> {
  try {
    const client = getRedisClient();
    if (client.status !== 'ready') {
      return fallback;
    }
    return await Promise.race([
      op(),
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 300)),
    ]);
  } catch {
    return fallback;
  }
}

export class AppClock {
  private offsetMs = 0;
  private isInitialized = false;

  async init(): Promise<void> {
    if (this.isInitialized) return;
    if (env.DB_ENVIRONMENT === 'production') {
      this.offsetMs = 0;
      this.isInitialized = true;
      return;
    }
    const client = getRedisClient();
    const stored = await safeRedisOp(() => client.get(CLOCK_OFFSET_REDIS_KEY), null);
    if (stored !== null) {
      this.offsetMs = parseInt(stored, 10) || 0;
    }
    this.isInitialized = true;
  }

  /**
   * Returns current simulated time if non-production and offset is active,
   * otherwise returns true real-time Date.
   */
  now(): Date {
    if (env.DB_ENVIRONMENT === 'production') {
      return new Date();
    }
    return new Date(Date.now() + this.offsetMs);
  }

  nowIso(): string {
    return this.now().toISOString();
  }

  getOffsetMs(): number {
    if (env.DB_ENVIRONMENT === 'production') return 0;
    return this.offsetMs;
  }

  async setOffsetMs(ms: number): Promise<number> {
    if (env.DB_ENVIRONMENT === 'production') {
      throw new Error('FATAL: Clock manipulation is strictly prohibited in production');
    }
    this.offsetMs = ms;
    const client = getRedisClient();
    await safeRedisOp(() => client.set(CLOCK_OFFSET_REDIS_KEY, String(ms)), 'OK');
    logger.info({ offsetMs: ms, simulatedTime: this.nowIso() }, '[AppClock] Offset updated');
    return this.offsetMs;
  }

  async advance(deltaMs: number): Promise<number> {
    return this.setOffsetMs(this.offsetMs + deltaMs);
  }

  async reset(): Promise<void> {
    if (env.DB_ENVIRONMENT === 'production') return;
    this.offsetMs = 0;
    const client = getRedisClient();
    await safeRedisOp(() => client.del(CLOCK_OFFSET_REDIS_KEY), 0);
    logger.info('[AppClock] Offset reset to real-time');
  }

  isShifted(): boolean {
    return this.getOffsetMs() !== 0;
  }

  todayIst(d?: Date): string {
    const target = d ?? this.now();
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(target);
  }

  formatIst(d?: Date): string {
    const target = d ?? this.now();
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(target);
  }
}

export const clock = new AppClock();
