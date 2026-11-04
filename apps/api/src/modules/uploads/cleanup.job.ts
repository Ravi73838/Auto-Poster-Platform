import { FILE_STATUS } from '@ap/shared-constants';
import { prisma } from '../../shared/db/index.js';
import { storageProvider } from '../../integrations/storage/index.js';
import { logger } from '../../shared/logger/index.js';

/**
 * Cleanup job stub for unconfirmed uploads older than 24 hours.
 * Cleans both S3 storage and pending database records.
 */
export async function cleanupUnconfirmedUploads(): Promise<{ cleanedCount: number }> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const staleFiles = await prisma.uploadedFile.findMany({
    where: {
      status: FILE_STATUS.PENDING,
      createdAt: { lt: cutoff },
    },
    take: 100,
  });

  let cleanedCount = 0;
  for (const file of staleFiles) {
    try {
      await storageProvider.delete(file.fileKey);
      await prisma.uploadedFile.delete({
        where: { id: file.id },
      });
      cleanedCount++;
    } catch (err) {
      logger.warn({ err, fileKey: file.fileKey }, 'Failed to clean up stale upload file');
    }
  }

  logger.info({ cleanedCount }, 'Cleaned up stale unconfirmed uploads');
  return { cleanedCount };
}

