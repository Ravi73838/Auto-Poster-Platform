import { prisma } from '../shared/db/index.js';
import {
  POSTER_FIX_STATUS,
  STRIKE_STATUS,
  ASSIGNMENT_STATUS,
} from '@ap/shared-constants';
import { PosterFixNoticeService } from '../modules/discipline/notice.service.js';
import { TerminationService } from '../modules/discipline/termination.service.js';
import { NotificationsService } from '../modules/notifications/notifications.service.js';
import { emitEvent } from '../events/index.js';
import { logger } from '../shared/logger/index.js';

export class DisciplineJobsService {
  /**
   * Hourly job: checks open poster fix notices whose deadline has passed
   */
  static async processPosterFixDeadlines(): Promise<number> {
    const now = new Date();
    const expiredNotices = await prisma.posterFixNotice.findMany({
      where: {
        status: POSTER_FIX_STATUS.OPEN,
        deadlineAt: { lte: now },
      },
    });

    let count = 0;
    for (const notice of expiredNotices) {
      try {
        await PosterFixNoticeService.expireNotice(notice.id);
        count++;
      } catch (err) {
        logger.error({ err, noticeId: notice.id }, '[DisciplineJobs] Failed to expire notice');
      }
    }

    logger.info({ processed: count }, '[DisciplineJobs] Processed poster fix deadlines');
    return count;
  }

  /**
   * Hourly job: lifts temporary bans that have expired
   */
  static async processBanExpiry(): Promise<number> {
    const now = new Date();
    const expiredBans = await prisma.driverBan.findMany({
      where: {
        endsAt: { not: null, lte: now },
        liftedAt: null,
      },
    });

    let count = 0;
    for (const ban of expiredBans) {
      try {
        await prisma.driverBan.update({
          where: { id: ban.id },
          data: {
            liftedAt: now,
            liftReason: 'Ban duration completed',
          },
        });

        // Check if other bans exist
        const remaining = await prisma.driverBan.count({
          where: {
            driverId: ban.driverId,
            liftedAt: null,
            OR: [{ endsAt: null }, { endsAt: { gt: now } }],
          },
        });

        if (remaining === 0) {
          await prisma.driverProfile.updateMany({
            where: { userId: ban.driverId },
            data: { bannedUntil: null },
          });
        }

        emitEvent('ban.lifted', {
          banId: ban.id,
          driverId: ban.driverId,
          liftedById: 'SYSTEM',
          reason: 'Ban duration completed',
        });

        NotificationsService.notify({
          key: 'ban.ended',
          userId: ban.driverId,
          data: {},
        }).catch(() => null);

        count++;
      } catch (err) {
        logger.error({ err, banId: ban.id }, '[DisciplineJobs] Failed to process ban expiry');
      }
    }

    logger.info({ processed: count }, '[DisciplineJobs] Processed ban expiry');
    return count;
  }

  /**
   * Daily job: marks expired strikes as EXPIRED
   */
  static async processStrikeExpiry(): Promise<number> {
    const now = new Date();
    const { count } = await prisma.strike.updateMany({
      where: {
        status: STRIKE_STATUS.ACTIVE,
        expiresAt: { lte: now },
      },
      data: {
        status: STRIKE_STATUS.EXPIRED as any,
      },
    });

    logger.info({ expiredStrikes: count }, '[DisciplineJobs] Processed strike expiry');
    return count;
  }

  /**
   * Daily job (03:00 IST): terminates abandoned assignments (>= 7 consecutive missed days)
   */
  static async processAbandonmentCheck(): Promise<number> {
    const runningAssignments = await prisma.assignment.findMany({
      where: {
        status: ASSIGNMENT_STATUS.RUNNING,
      },
      include: {
        days: {
          orderBy: { date: 'desc' },
          take: 10,
        },
      },
    });

    let count = 0;
    for (const assignment of runningAssignments) {
      const recentDays = assignment.days || [];
      // Count consecutive missed days from the most recent day backwards
      let consecutiveMissed = 0;
      for (const day of recentDays) {
        if (day.status === 'MISSED') {
          consecutiveMissed++;
        } else if (day.status === 'VERIFIED' || day.status === 'EXCUSED') {
          break;
        }
      }

      if (consecutiveMissed >= 7) {
        logger.warn(
          { assignmentId: assignment.id, consecutiveMissed },
          '[DisciplineJobs] Assignment abandoned (7+ consecutive missed days), terminating',
        );
        try {
          await TerminationService.terminate(assignment.id, {
            reason: 'ABANDONED',
            terminatedById: 'SYSTEM',
            notes: `Vehicle abandoned campaign: ${consecutiveMissed} consecutive missed days without upload`,
          });
          count++;
        } catch (err) {
          logger.error({ err, assignmentId: assignment.id }, '[DisciplineJobs] Failed to terminate abandoned assignment');
        }
      }
    }

    logger.info({ abandonedTerminated: count }, '[DisciplineJobs] Processed abandonment check');
    return count;
  }
}
