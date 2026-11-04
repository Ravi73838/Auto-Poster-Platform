import { createWorker, registerRepeatableJobs } from './index.js';
import { createNotificationDeliveryWorker } from '../modules/notifications/notification-delivery.queue.js';
import { registerCampaignEventListeners } from '../events/listeners/campaign.listeners.js';
import { registerFinanceEventListeners } from '../events/listeners/finance.listeners.js';
import { registerDisciplineEventListeners } from '../events/listeners/discipline.listeners.js';
import { logger } from '../shared/logger/index.js';
import { env } from '../config/env.js';

logger.info({ env: env.NODE_ENV }, 'Starting Auto Poster Background Worker...');

// Register event listeners so notifications are dispatched
registerCampaignEventListeners();
registerFinanceEventListeners();
registerDisciplineEventListeners();

// Register recurring jobs in BullMQ
await registerRepeatableJobs();

// Start the BullMQ worker
const worker = createWorker();
const notificationWorker = createNotificationDeliveryWorker();
logger.info('BullMQ worker active and listening for scheduled jobs & notification deliveries');

async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down worker gracefully...');
  await Promise.all([worker.close(), notificationWorker.close()]);
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
