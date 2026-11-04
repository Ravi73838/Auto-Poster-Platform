import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
import { logger } from './logger/index.js';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

const isTest =
  process.env.NODE_ENV === 'test' ||
  process.env.VITEST === 'true' ||
  Boolean(process.env.VITEST_WORKER_ID);

const effectiveDbUrl = isTest
  ? (process.env.DATABASE_URL_TEST ||
     env.DATABASE_URL_TEST ||
     'postgresql://autoposter:autoposter_local_secret@127.0.0.1:5432/autoposter_test?schema=public')
  : env.DATABASE_URL;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: effectiveDbUrl,
      },
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
