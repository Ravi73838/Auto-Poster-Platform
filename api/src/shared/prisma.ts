import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
import { logger } from './logger/index.js';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

const isTest =
  process.env.NODE_ENV === 'test' ||
  process.env.VITEST === 'true' ||
  Boolean(process.env.VITEST_WORKER_ID);

function toReachableSupabaseUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    if (u.hostname.startsWith('db.') && u.hostname.endsWith('.supabase.co')) {
      const parts = u.hostname.split('.');
      const ref = parts[1]!;
      u.hostname = 'aws-0-ap-northeast-1.pooler.supabase.com';
      u.username = `postgres.${ref}`;
      u.port = '5432';
    }
    if (!u.searchParams.has('connection_limit')) {
      u.searchParams.set('connection_limit', '15');
    }
    if (!u.searchParams.has('pool_timeout')) {
      u.searchParams.set('pool_timeout', '30');
    }
    return u.toString();
  } catch {
    // ignore
  }
  return rawUrl;
}

const rawUrl = isTest
  ? (process.env.DATABASE_URL_TEST || env.DATABASE_URL_TEST || env.DATABASE_URL)
  : env.DATABASE_URL;

const effectiveDbUrl = toReachableSupabaseUrl(rawUrl);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: effectiveDbUrl,
      },
    },
    transactionOptions: {
      maxWait: 10000,
      timeout: 30000,
    },
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function disconnectPrisma(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('Prisma disconnected successfully');
  } catch (error) {
    logger.error({ error }, 'Error disconnecting Prisma');
  }
}
