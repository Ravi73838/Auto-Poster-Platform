import { logger } from '../shared/logger/index.js';
import { disconnectPrisma } from '../shared/db/index.js';
import { seedBase } from './base.js';

export async function seedDemo(): Promise<void> {
  logger.info('Demo seed data has been removed. Ensuring only base system foundation is present...');
  await seedBase();
  logger.info('Ready for clean registration flow.');
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`) {
  seedDemo()
    .catch((err) => {
      logger.error({ err }, 'Seed failed');
      process.exit(1);
    })
    .finally(async () => {
      await disconnectPrisma();
    });
}
