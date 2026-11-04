import { eventBus } from '../index.js';
import { StrikeService } from '../../modules/discipline/strike.service.js';
import { PosterFixNoticeService } from '../../modules/discipline/notice.service.js';
import { prisma } from '../../shared/db/index.js';
import { STRIKE_SOURCE, POSTER_FIX_STATUS } from '@ap/shared-constants';
import { logger } from '../../shared/logger/index.js';

export function registerDisciplineEventListeners(): void {
  // 1. Photo Fraud Suspected -> Issue Strike for FAKE_OR_OLD_PHOTO
  eventBus.on('photo.fraud_suspected', async (event) => {
    try {
      logger.info({ photoId: event.photoId, driverId: event.driverId }, '[DisciplineListeners] photo.fraud_suspected received');

      // Fetch driver's User.id
      const driver = await prisma.driverProfile.findUnique({
        where: { id: event.driverId },
        select: { userId: true },
      });

      const driverUserId = driver?.userId ?? event.driverId;

      await StrikeService.issue({
        driverId: driverUserId,
        assignmentId: event.assignmentId,
        photoId: event.photoId,
        reason: 'FAKE_OR_OLD_PHOTO',
        source: STRIKE_SOURCE.AUTO_RULE,
        notes: `Automated fraud check triggered: ${event.reason}`,
        dedupeKey: `strike:fraud:${event.photoId}`,
      });
    } catch (err) {
      logger.error({ err, photoId: event.photoId }, '[DisciplineListeners] Error handling photo.fraud_suspected');
    }
  });

  // 2. Photo Rejected -> Open PosterFixNotice if damaged or removed
  eventBus.on('photo.rejected', async (event) => {
    try {
      const isDamagedOrRemoved = event.reasons.some(
        (r) =>
          r.code === 'POSTER_REMOVED_OR_DAMAGED' ||
          r.code === 'POSTER_NOT_VISIBLE' ||
          r.code === 'DAMAGED_POSTER',
      );

      if (isDamagedOrRemoved) {
        logger.info({ photoId: event.photoId, assignmentId: event.assignmentId }, '[DisciplineListeners] Opening PosterFixNotice for rejected photo');
        await PosterFixNoticeService.createNotice({
          assignmentId: event.assignmentId,
          sourcePhotoId: event.photoId,
        });
      }
    } catch (err) {
      logger.error({ err, photoId: event.photoId }, '[DisciplineListeners] Error handling photo.rejected');
    }
  });

  // 3. Photo Flag Resolved Upheld -> Open PosterFixNotice
  eventBus.on('photo.flag_resolved', async (event) => {
    try {
      if (event.status === 'VALID' || event.status === 'UPHELD') {
        const photo = await prisma.photo.findUnique({
          where: { id: event.photoId },
          select: { assignmentId: true },
        });

        if (photo?.assignmentId) {
          logger.info({ photoId: event.photoId, assignmentId: photo.assignmentId }, '[DisciplineListeners] Opening PosterFixNotice for resolved photo flag');
          await PosterFixNoticeService.createNotice({
            assignmentId: photo.assignmentId,
            sourcePhotoId: event.photoId,
          });
        }
      }
    } catch (err) {
      logger.error({ err, photoId: event.photoId }, '[DisciplineListeners] Error handling photo.flag_resolved');
    }
  });

  // 4. Photo Verified -> Resolve open PosterFixNotice
  eventBus.on('photo.verified', async (event) => {
    try {
      const openNotice = await prisma.posterFixNotice.findFirst({
        where: {
          assignmentId: event.assignmentId,
          status: POSTER_FIX_STATUS.OPEN,
        },
      });

      if (openNotice) {
        logger.info({ noticeId: openNotice.id, photoId: event.photoId }, '[DisciplineListeners] Resolving PosterFixNotice after verified photo');
        await PosterFixNoticeService.resolveNotice(openNotice.id, event.photoId);
      }
    } catch (err) {
      logger.error({ err, photoId: event.photoId }, '[DisciplineListeners] Error handling photo.verified');
    }
  });

  logger.info('Registered discipline event listeners');
}

