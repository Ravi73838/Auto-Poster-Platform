import { prisma } from '../../shared/prisma.js';
import { getRedisClient } from '../../shared/redis/index.js';
import { logger } from '../../shared/logger/index.js';
import type { SystemHealthCheckResult } from './types.js';

export class HealthRepository {
  async checkServices(): Promise<SystemHealthCheckResult> {
    let database: 'connected' | 'disconnected' | 'disabled' = 'disconnected';
    let redis: 'connected' | 'disconnected' | 'disabled' = 'disconnected';

    try {
      await prisma.$queryRaw`SELECT 1`;
      database = 'connected';
    } catch (err) {
      logger.warn({ err }, 'Health check database query failed');
      database = 'disconnected';
    }

    try {
      const client = getRedisClient();
      const pong = await client.ping();
      redis = pong === 'PONG' ? 'connected' : 'disconnected';
    } catch (err) {
      logger.warn({ err }, 'Health check redis ping failed');
      redis = 'disconnected';
    }

    return { database, redis };
  }
}
