import { logger } from '../logger/index.js';

interface MemoryEntry {
  value: string;
  expiresAt: number | null;
}

/**
 * High-performance, lightweight in-memory key-value store with TTL support.
 * Replaces external Redis server dependency and socket connections with zero overhead.
 */
export class InMemoryRedisClient {
  private store = new Map<string, MemoryEntry>();
  public status = 'ready';

  private isExpired(entry: MemoryEntry): boolean {
    if (entry.expiresAt === null) return false;
    return Date.now() > entry.expiresAt;
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (this.isExpired(entry)) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: unknown, ...args: any[]): Promise<'OK' | null> {
    let ttlSeconds: number | null = null;
    let onlyIfNotExist = false;

    for (let i = 0; i < args.length; i++) {
      const arg = String(args[i]).toUpperCase();
      if (arg === 'EX' && i + 1 < args.length) {
        ttlSeconds = Number(args[i + 1]);
        i++;
      } else if (arg === 'PX' && i + 1 < args.length) {
        ttlSeconds = Number(args[i + 1]) / 1000;
        i++;
      } else if (arg === 'NX') {
        onlyIfNotExist = true;
      }
    }

    if (onlyIfNotExist) {
      const existing = this.store.get(key);
      if (existing && !this.isExpired(existing)) {
        return null;
      }
    }

    const expiresAt = ttlSeconds !== null ? Date.now() + ttlSeconds * 1000 : null;
    this.store.set(key, { value: String(value), expiresAt });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.store.delete(key)) count++;
    }
    return count;
  }

  async incr(key: string): Promise<number> {
    const entry = this.store.get(key);
    let num = 0;
    let expiresAt: number | null = null;

    if (entry && !this.isExpired(entry)) {
      num = parseInt(entry.value, 10) || 0;
      expiresAt = entry.expiresAt;
    }

    num += 1;
    this.store.set(key, { value: String(num), expiresAt });
    return num;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const entry = this.store.get(key);
    if (!entry || this.isExpired(entry)) {
      this.store.delete(key);
      return 0;
    }
    entry.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    const matches: string[] = [];
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt !== null && now > entry.expiresAt) {
        this.store.delete(key);
        continue;
      }
      if (regex.test(key)) {
        matches.push(key);
      }
    }
    return matches;
  }

  async flushdb(): Promise<'OK'> {
    this.store.clear();
    return 'OK';
  }

  on(_event: string, _handler: any): this {
    return this;
  }

  async quit(): Promise<void> {}
  disconnect(): void {}
}

export type Redis = InMemoryRedisClient;

const inMemoryInstance = new InMemoryRedisClient();

export async function ensureRedisServer(): Promise<void> {
  // In-memory mode: zero external Redis server or subprocess required.
}

export function getEffectiveRedisUrl(): string {
  return 'inmemory://local';
}

export function getRedisClient(): InMemoryRedisClient {
  return inMemoryInstance;
}

export const redisClient: InMemoryRedisClient = inMemoryInstance;

export function getBullMQRedisOptions(): any {
  return {
    host: 'localhost',
    port: 0,
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
  return {
    status: 'ok',
    latencyMs: 0,
  };
}

export async function disconnectRedis(): Promise<void> {
  // In-memory mode: no network connections to tear down.
}
