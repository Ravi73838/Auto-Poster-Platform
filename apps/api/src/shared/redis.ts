import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from './logger/index.js';

let redisInstance: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    });

    redisInstance.on('error', (err) => {
      logger.warn({ err }, 'Redis connection error (non-fatal for Phase 1 skeleton)');
    });
  }
  return redisInstance;
}

export async function disconnectRedis(): Promise<void> {
  if (redisInstance) {
    try {
      await redisInstance.quit();
      logger.info('Redis client disconnected');
    } catch {
      redisInstance.disconnect();
    } finally {
      redisInstance = null;
    }
  }
}
