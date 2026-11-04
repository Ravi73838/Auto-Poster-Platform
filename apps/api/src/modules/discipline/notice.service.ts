import { prisma } from '../../shared/db/index.js';
import {
  POSTER_FIX_STATUS,
  SETTING_KEYS,
  STRIKE_SOURCE,
  STRIKE_REASONS,
  ERROR_CODES,
} from '@ap/shared-constants';
import { AppError } from '../../shared/errors/app-error.js';
import { emitEvent } from '../../events/index.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { logger } from '../../shared/logger/index.js';

export class PosterFixNoticeService {
  static async createNotice(params: {
    assignmentId: string;
    sourcePhotoId?: string;
  }) {
    const assignment = await prisma.assignment.findUnique({
      where: { id: params.assignmentId },
    });

    if (!assignment) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'Assignment not found');
    }

    // Check if open notice already exists
    const existing = await prisma.posterFixNotice.findFirst({
      where: {
        assignmentId: params.assignmentId,
        status: POSTER_FIX_STATUS.OPEN,
      },
    });

    if (existing) {
      return existing;
    }

    const fixHours = await SettingsService.get(
      SETTING_KEYS.POSTER_FIX_HOURS,
      48,
    );

    const now = new Date();
    const deadlineAt = new Date(now.getTime() + fixHours * 60 * 60 * 1000);

    const notice = await prisma.posterFixNotice.create({
      data: {
        assignmentId: params.assignmentId,
        sourcePhotoId: params.sourcePhotoId,
        deadlineAt,
        status: POSTER_FIX_STATUS.OPEN,
      },
    });

    // Mark force manual review on assignment
    await prisma.assignment.update({
      where: { id: params.assignmentId },
      data: { forceManualReview: true },
    }).catch(() => null);

    emitEvent('poster_fix.opened', {
      noticeId: notice.id,
      assignmentId: params.assignmentId,
      driverId: assignment.driverId,
      deadlineAt,
      sourcePhotoId: params.sourcePhotoId ?? null,
    });

    NotificationsService.notify({
      key: 'poster_fix.opened',
      userId: assignment.driverId,
      data: {
        deadline: deadlineAt.toISOString(),
      },
    }).catch((err) => {
      logger.error({ err, noticeId: notice.id }, '[PosterFixNoticeService] Failed to notify driver');
    });

    return notice;
  }

  static async resolveNotice(noticeId: string, resolvedPhotoId: string) {
    const notice = await prisma.posterFixNotice.findUnique({
      where: { id: noticeId },
      include: {
        assignment: true,
      },
    });

    if (!notice || notice.status !== POSTER_FIX_STATUS.OPEN) {
      return notice;
    }

    const updated = await prisma.posterFixNotice.update({
      where: { id: noticeId },
      data: {
        status: POSTER_FIX_STATUS.RESOLVED,
        resolvedPhotoId,
      },
    });

    // Clear forceManualReview if no other open notices exist
    const otherOpen = await prisma.posterFixNotice.count({
      where: {
        assignmentId: notice.assignmentId,
        status: POSTER_FIX_STATUS.OPEN,
        id: { not: noticeId },
      },
    });

    if (otherOpen === 0) {
      await prisma.assignment.update({
        where: { id: notice.assignmentId },
        data: { forceManualReview: false },
      }).catch(() => null);
    }

    emitEvent('poster_fix.resolved', {
      noticeId,
      assignmentId: notice.assignmentId,
      driverId: notice.assignment.driverId,
      resolvedPhotoId,
    });

    NotificationsService.notify({
      key: 'poster_fix.resolved',
      userId: notice.assignment.driverId,
      data: {},
    }).catch((err) => {
      logger.error({ err, noticeId }, '[PosterFixNoticeService] Failed to notify driver');
    });

    return updated;
  }

  static async expireNotice(noticeId: string) {
    const notice = await prisma.posterFixNotice.findUnique({
      where: { id: noticeId },
      include: {
        assignment: true,
      },
    });

    if (!notice || notice.status !== POSTER_FIX_STATUS.OPEN) {
      return notice;
    }

    const updated = await prisma.posterFixNotice.update({
      where: { id: noticeId },
      data: {
        status: POSTER_FIX_STATUS.STRIKED,
      },
    });

    emitEvent('poster_fix.expired', {
      noticeId,
      assignmentId: notice.assignmentId,
      driverId: notice.assignment.driverId,
    });

    // Import StrikeService dynamically or issue strike directly
    const { StrikeService } = await import('./strike.service.js');
    await StrikeService.issue({
      driverId: notice.assignment.driverId, // User.id
      assignmentId: notice.assignmentId,
      reason: STRIKE_REASONS.POSTER_DAMAGED_NOT_FIXED,
      source: STRIKE_SOURCE.AUTO_RULE,
      notes: `Poster fix notice #${notice.id} expired after 48h deadline without valid photo proof`,
    }).catch((err) => {
      logger.error({ err, noticeId }, '[PosterFixNoticeService] Failed to issue strike on expiry');
    });

    return updated;
  }
}
