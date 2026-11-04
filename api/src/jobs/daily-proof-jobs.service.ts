import { prisma } from '../shared/db/index.js';
import {
  DAY_STATUS,
  SETTING_KEYS,
  ASSIGNMENT_STATUS,
} from '@ap/shared-constants';
import { TimeService, toISTDate, todayIST } from '../shared/time/index.js';
import { logger } from '../shared/logger/index.js';
import { SettingsService } from '../modules/settings/settings.service.js';
import { AssignmentDaysService } from '../modules/assignment-days/assignment-days.service.js';
import { storageProvider } from '../integrations/storage/index.js';

export class DailyProofJobsService {
  /**
   * Rolls daily assignment days past cutoff from PENDING/REJECTED to MISSED.
   */
  static async processDailyDayRoll(): Promise<number> {
    const rolled = await AssignmentDaysService.processDailyDayRoll();
    if (rolled.newlyMissedDays > 0) {
      logger.info({ newlyMissedDays: rolled.newlyMissedDays }, 'daily-day-roll job: rolled days past cutoff to MISSED');
    }
    return rolled.newlyMissedDays;
  }

  /**
   * Sends photo upload reminders to drivers with RUNNING assignments who haven't uploaded today.
   */
  static async processDailyPhotoReminder(): Promise<number> {
    const todayStr = todayIST();
    const todayUtc = new Date(`${todayStr}T00:00:00.000Z`);

    const runningAssignments = await prisma.assignment.findMany({
      where: {
        status: ASSIGNMENT_STATUS.RUNNING,
      },
      select: {
        id: true,
        driverId: true,
        campaign: { select: { title: true } },
      },
    });

    let reminded = 0;
    const now = TimeService.now();
    const currentHourUtc = now.getUTCHours(); // IST is UTC+5:30

    // Dedupe key based on date and time slot (e.g. morning/evening)
    const slot = currentHourUtc < 10 ? 'morning' : 'evening';

    for (const assignment of runningAssignments) {
      // Check if driver already has a verified or under-review day today
      const todayDay = await prisma.assignmentDay.findUnique({
        where: {
          assignmentId_date: {
            assignmentId: assignment.id,
            date: todayUtc,
          },
        },
      });

      if (todayDay?.status === DAY_STATUS.VERIFIED || todayDay?.status === DAY_STATUS.UNDER_REVIEW) {
        continue;
      }

      const dedupeKey = `photo-remind-${assignment.id}-${todayStr}-${slot}`;

      const existingNotif = await prisma.notification.findFirst({
        where: { dedupeKey },
      });

      if (!existingNotif) {
        await prisma.notification.create({
          data: {
            userId: assignment.driverId,
            channel: 'IN_APP',
            title: 'Daily Poster Photo Needed',
            body: `Please upload your daily auto poster photo for ${assignment.campaign.title} today.`,
            dedupeKey,
            data: { assignmentId: assignment.id, date: todayStr },
          },
        });
        reminded++;
      }
    }

    if (reminded > 0) {
      logger.info({ reminded }, 'daily-photo-reminder job: sent daily photo reminders');
    }
    return reminded;
  }

  /**
   * Notifies drivers about missed days and remaining grace days.
   */
  static async processMissedDayNotice(): Promise<number> {
    const graceDays = await SettingsService.get(SETTING_KEYS.GRACE_DAYS).catch(() => 3);

    const missedDays = await prisma.assignmentDay.findMany({
      where: {
        status: DAY_STATUS.MISSED,
      },
      include: {
        assignment: {
          select: {
            id: true,
            driverId: true,
            missedDays: true,
            campaign: { select: { title: true } },
          },
        },
      },
      take: 100,
      orderBy: { statusChangedAt: 'desc' },
    });

    let notified = 0;
    for (const day of missedDays) {
      const dateStr = toISTDate(day.date);
      const dedupeKey = `missed-day-notice-${day.assignmentId}-${dateStr}`;

      const existingNotif = await prisma.notification.findFirst({
        where: { dedupeKey },
      });

      if (!existingNotif) {
        const graceLeft = Math.max(0, graceDays - day.assignment.missedDays);
        await prisma.notification.create({
          data: {
            userId: day.assignment.driverId,
            channel: 'IN_APP',
            title: 'Daily Photo Missed',
            body: `You missed uploading photo for ${dateStr} on ${day.assignment.campaign.title}. Grace days remaining: ${graceLeft}.`,
            dedupeKey,
            data: {
              assignmentId: day.assignmentId,
              date: dateStr,
              graceDaysLeft: graceLeft,
            },
          },
        });
        notified++;
      }
    }

    if (notified > 0) {
      logger.info({ notified }, 'missed-day-notice job: sent missed day notices');
    }
    return notified;
  }

  /**
   * Alerts when unreviewed daily photos exceed SLA.
   */
  static async processDailyReviewSlaAlert(): Promise<number> {
    const slaHours = await SettingsService.get(SETTING_KEYS.DAILY_REVIEW_SLA_HOURS).catch(() => 4);
    const slaCutoff = new Date(TimeService.now().getTime() - slaHours * 60 * 60 * 1000);

    const breachedPhotos = await prisma.photo.findMany({
      where: {
        kind: 'DAILY',
        status: 'MANUAL_REVIEW',
        uploadedAt: { lt: slaCutoff },
      },
      select: { id: true, uploadedAt: true, assignmentId: true },
      take: 50,
    });

    if (breachedPhotos.length > 0) {
      logger.warn(
        { breachedCount: breachedPhotos.length, slaHours },
        'daily-review-sla-alert job: daily photos breaching review SLA',
      );
    }

    return breachedPhotos.length;
  }

  /**
   * Cleans up orphaned uploads after 24h.
   */
  static async processStaleUploadCleanup(): Promise<number> {
    const dayAgo = new Date(TimeService.now().getTime() - 24 * 60 * 60 * 1000);

    const staleUploads = await prisma.uploadedFile.findMany({
      where: {
        createdAt: { lt: dayAgo },
      },
      take: 100,
    });

    let cleaned = 0;
    for (const upload of staleUploads) {
      // Check if attached to photo, document, or campaign
      const [inPhoto, inDoc, inCampaign] = await Promise.all([
        prisma.photo.count({ where: { OR: [{ photoUrl: upload.fileKey }, { thumbnailUrl: upload.fileKey }] } }),
        prisma.document.count({ where: { uploadedFileId: upload.id } }),
        prisma.campaign.count({ where: { creativeUrl: upload.fileKey } }),
      ]);

      if (inPhoto === 0 && inDoc === 0 && inCampaign === 0) {
        try {
          await storageProvider.delete(upload.fileKey);
          if (upload.thumbnailKey) {
            await storageProvider.delete(upload.thumbnailKey);
          }
        } catch {}

        await prisma.uploadedFile.delete({ where: { id: upload.id } });
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info({ cleaned }, 'stale-upload-cleanup job: removed unattached files');
    }
    return cleaned;
  }

  /**
   * Stub for retention job (Phase 10+ long-term archiving).
   */
  static async processPhotoRetention(): Promise<number> {
    logger.debug('photo-retention job: retention rules checked');
    return 0;
  }
}
