import { Redis, type RedisOptions } from 'ioredis';
import { env } from '../../config/env.js';
import { logger } from '../logger/index.js';

let redisInstance: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 20,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      enableOfflineQueue: true,
      lazyConnect: false,
    });

    redisInstance.on('error', (err) => {
      logger.warn({ err }, 'Redis connection error');
    });

    redisInstance.on('connect', () => {
      logger.info('Connected to Redis');
    });
  }
  return redisInstance;
}

export const redisClient: Redis = new Proxy({} as Redis, {
  get(_target, prop) {
    const client = getRedisClient();
    const val = (client as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof val === 'function') {
      return val.bind(client);
    }
    return val;
  },
});

/**
 * Returns Redis configuration suitable for BullMQ.
 * BullMQ requires `maxRetriesPerRequest: null` and `enableReadyCheck: false`.
 */
export function getBullMQRedisOptions(): RedisOptions {
  const url = new URL(env.REDIS_URL);
  return {
    host: url.hostname || 'localhost',
    port: parseInt(url.port || '6379', 10),
    password: url.password || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

export interface RedisHealthResult {
  status: 'ok' | 'down';
  latencyMs?: number;
  error?: string;
}

export async function checkRedisHealth(): Promise<RedisHealthResult> {
  const client = getRedisClient();
  const start = Date.now();
  try {
    const pong = await client.ping();
    if (pong === 'PONG') {
      return {
        status: 'ok',
        latencyMs: Date.now() - start,
      };
    }
    return {
      status: 'down',
      error: `Unexpected ping response: ${pong}`,
    };
  } catch (error) {
    return {
      status: 'down',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redisInstance) {
    try {
      await redisInstance.quit();
      logger.info('Redis client disconnected gracefully');
    } catch {
      redisInstance.disconnect();
    } finally {
      redisInstance = null;
    }
  }
}
