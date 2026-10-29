import { prisma } from '../../shared/prisma.js';
import { getRedisClient } from '../../shared/redis.js';
import type { SystemHealthCheckResult } from './types.js';

export class HealthRepository {
  async checkServices(): Promise<SystemHealthCheckResult> {
    let database: 'connected' | 'disconnected' | 'disabled' = 'disconnected';
    let redis: 'connected' | 'disconnected' | 'disabled' = 'disconnected';

    try {
      await prisma.$queryRaw`SELECT 1`;
      database = 'connected';
    } catch {
      database = 'disconnected';
    }

    try {
      const client = getRedisClient();
      const pong = await client.ping();
      redis = pong === 'PONG' ? 'connected' : 'disconnected';
    } catch {
      redis = 'disconnected';
    }

    return { database, redis };
  }
}
