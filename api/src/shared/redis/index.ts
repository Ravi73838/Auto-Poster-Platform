import { Redis, type RedisOptions } from 'ioredis';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { env } from '../../config/env.js';
import { logger } from '../logger/index.js';

let redisInstance: Redis | null = null;

export async function ensureRedisServer(): Promise<void> {
  const url = new URL(env.REDIS_URL);
  const port = parseInt(url.port || '6380', 10);
  const host = url.hostname || '127.0.0.1';

  if (host !== '127.0.0.1' && host !== 'localhost') return;

  const check = () =>
    new Promise<boolean>((resolve) => {
      const socket = net.createConnection({ host, port }, () => {
        socket.end();
        resolve(true);
      });
      socket.on('error', () => resolve(false));
      socket.setTimeout(400, () => {
        socket.destroy();
        resolve(false);
      });
    });

  if (await check()) return;

  const candidates = [
    path.join(os.homedir(), '.redis', 'redis-server.exe'),
    'C:\\Users\\Ravi\\.redis\\redis-server.exe',
  ];
  const binary = candidates.find((p) => fs.existsSync(p));
  if (!binary) return;

  try {
    const child = spawn(binary, ['--port', String(port)], {
      detached: true,
      stdio: 'ignore',
      cwd: path.dirname(binary),
    });
    child.unref();

    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 100));
      if (await check()) {
        logger.info(`Redis 8 server auto-started on port ${port}`);
        return;
      }
    }
  } catch (err) {
    logger.warn({ err }, 'Could not auto-start Redis server');
  }
}

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
    port: parseInt(url.port || '6380', 10),
    password: url.password || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => Math.min(times * 100, 3000),
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
