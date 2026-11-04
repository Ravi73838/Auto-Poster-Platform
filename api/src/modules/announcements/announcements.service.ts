import { prisma } from '../../shared/db/index.js';
import {
  ANNOUNCEMENT_STATUS,
  type Role,
  ERROR_CODES,
} from '@ap/shared-constants';
import { AppError } from '../../shared/errors/app-error.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { logger } from '../../shared/logger/index.js';
import type { CreateAnnouncementInput } from '@ap/shared-validation';

export class AnnouncementsService {
  static async create(adminUserId: string, input: CreateAnnouncementInput) {
    const scheduledFor = input.scheduledFor ? new Date(input.scheduledFor) : null;
    const shouldSendNow = input.sendNow || !scheduledFor;

    const announcement = await prisma.announcement.create({
      data: {
        createdById: adminUserId,
        titleByLanguage: input.titleByLanguage as any,
        bodyByLanguage: input.bodyByLanguage as any,
        audience: input.audience as any,
        scheduledFor,
        status: shouldSendNow ? (ANNOUNCEMENT_STATUS.SENDING as any) : (ANNOUNCEMENT_STATUS.SCHEDULED as any),
        counts: { target: 0, sent: 0, failed: 0 },
      },
    });

    if (shouldSendNow) {
      // Dispatch immediately in background
      this.dispatch(announcement.id).catch((err) => {
        logger.error({ err, announcementId: announcement.id }, '[AnnouncementsService] Immediate dispatch failed');
      });
    }

    return announcement;
  }

  static async list(options: { page?: number; limit?: number }) {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.max(1, Math.min(100, options.limit ?? 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.announcement.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          createdBy: {
            select: { id: true, email: true, mobile: true },
          },
        },
      }),
      prisma.announcement.count(),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getById(id: string) {
    const announcement = await prisma.announcement.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, email: true, mobile: true },
        },
      },
    });

    if (!announcement) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'Announcement not found');
    }

    return announcement;
  }

  static async dispatch(announcementId: string): Promise<void> {
    const announcement = await prisma.announcement.findUnique({
      where: { id: announcementId },
    });

    if (!announcement) return;

    await prisma.announcement.update({
      where: { id: announcementId },
      data: { status: ANNOUNCEMENT_STATUS.SENDING as any },
    });

    const audience = announcement.audience as {
      roles?: string[];
      cityIds?: string[];
      accountStatuses?: string[];
      activeOnly?: boolean;
    };

    const where: any = {};
    if (audience.roles && audience.roles.length > 0) {
      where.role = { in: audience.roles };
    }
    if (audience.accountStatuses && audience.accountStatuses.length > 0) {
      where.accountStatus = { in: audience.accountStatuses };
    }

    const recipients = await prisma.user.findMany({
      where,
      select: { id: true, preferredLanguage: true, role: true },
    });

    const titleByLang = (announcement.titleByLanguage ?? {}) as Record<string, string>;
    const bodyByLang = (announcement.bodyByLanguage ?? {}) as Record<string, string>;

    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of recipients) {
      const userLang = recipient.preferredLanguage || 'en';
      const title = titleByLang[userLang] || titleByLang['en'] || Object.values(titleByLang)[0] || 'Announcement';
      const body = bodyByLang[userLang] || bodyByLang['en'] || Object.values(bodyByLang)[0] || '';

      try {
        await NotificationsService.notify({
          key: 'announcement.broadcast',
          userId: recipient.id,
          audienceRole: recipient.role as Role,
          data: { title, body },
        });
        sentCount++;
      } catch (err) {
        logger.error({ err, userId: recipient.id, announcementId }, '[AnnouncementsService] Delivery error');
        failedCount++;
      }
    }

    await prisma.announcement.update({
      where: { id: announcementId },
      data: {
        status: ANNOUNCEMENT_STATUS.SENT as any,
        sentAt: new Date(),
        counts: {
          target: recipients.length,
          sent: sentCount,
          failed: failedCount,
        },
      },
    });
  }
}
