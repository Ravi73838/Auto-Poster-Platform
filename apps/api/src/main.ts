import type { Server } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './shared/logger/index.js';
import { disconnectPrisma } from './shared/prisma.js';
import { disconnectRedis } from './shared/redis.js';

const app = createApp();

const server: Server = app.listen(env.API_PORT, () => {
  logger.info(`Auto Poster Platform API running on port ${env.API_PORT} in [${env.NODE_ENV}] mode`);
});

let isShuttingDown = false;

async function handleShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ signal }, 'Graceful shutdown initiated...');

  server.close(async () => {
    logger.info('HTTP server closed');
    await disconnectPrisma();
    await disconnectRedis();
    logger.info('Graceful shutdown completed');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forceful shutdown after timeout');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

