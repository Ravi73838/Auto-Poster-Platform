import { prisma } from '../../shared/db/index.js';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_STATUS,
  DELIVERY_STATUS,
  ROLES,
  type Role,
  type NotificationChannel,
  type Language,
  ERROR_CODES,
  SETTING_KEYS,
} from '@ap/shared-constants';
import { AppError } from '../../shared/errors/app-error.js';
import { logger } from '../../shared/logger/index.js';
import {
  NOTIFICATION_REGISTRY,
  getNotificationDefinition,
  type NotificationDefinition,
} from './notification.registry.js';
import {
  getISTTime,
  isInQuietHours,
  getNextQuietHoursEnd,
  resolveNotificationText,
} from './notifications.helpers.js';
import {
  notificationDeliveryQueue,
  type NotificationDeliveryJobData,
} from './notification-delivery.queue.js';
import { SettingsService } from '../settings/settings.service.js';

export interface NotifyParams {
  key: string;
  userId: string;
  audienceRole?: Role;
  data?: Record<string, unknown>;
  dedupeKey?: string;
  channelsOverride?: NotificationChannel[];
  forceImmediate?: boolean;
}

export interface NotifyResult {
  notificationId: string;
  channels: NotificationChannel[];
}

export class NotificationsService {
  /**
   * The single entry point to dispatch notifications in the platform.
   */
  static async notify(params: NotifyParams): Promise<NotifyResult> {
    const def = getNotificationDefinition(params.key);

    // Check existing dedupe
    if (params.dedupeKey) {
      const existing = await prisma.notification.findUnique({
        where: { dedupeKey: params.dedupeKey },
      });
      if (existing) {
        logger.debug({ dedupeKey: params.dedupeKey }, '[NotificationsService] Dedupe hit, returning existing');
        return {
          notificationId: existing.id,
          channels: [],
        };
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      include: {
        notificationSettings: true,
        notificationPreferences: true,
      },
    });

    if (!user) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 404, `User ${params.userId} not found`);
    }

    const userRole = (params.audienceRole ?? user.role) as Role;
    let targetChannels: NotificationChannel[] = params.channelsOverride
      ? [...params.channelsOverride]
      : [...(def.defaultChannels[userRole] ?? [NOTIFICATION_CHANNELS.IN_APP])];

    // If not mandatory, filter according to user preferences
    if (!def.mandatory) {
      const prefs = user.notificationPreferences || [];
      const disabledChannels = new Set(
        prefs
          .filter((p: any) => p.category === def.category && !p.enabled)
          .map((p: any) => p.channel as NotificationChannel),
      );

      targetChannels = targetChannels.filter((ch) => !disabledChannels.has(ch));
    }

    // Always keep IN_APP unless explicitly empty
    if (!targetChannels.includes(NOTIFICATION_CHANNELS.IN_APP)) {
      targetChannels.unshift(NOTIFICATION_CHANNELS.IN_APP);
    }

    const lang = (user.preferredLanguage as Language) || 'en';
    const { title, body } = resolveNotificationText(def.titleKey, def.bodyKey, lang, params.data);

    // Quiet hours & Daily Push Cap check for PUSH
    let pushScheduledFor: Date | null = null;
    const now = new Date();

    if (targetChannels.includes(NOTIFICATION_CHANNELS.PUSH)) {
      const isCritical = def.priority === NOTIFICATION_PRIORITIES.URGENT;

      // 1. Daily Push Cap
      if (!isCritical && !params.forceImmediate) {
        const { dateStr } = getISTTime(now);
        const startOfISTDayUtc = new Date(`${dateStr}T00:00:00+05:30`);

        const pushCountToday = await prisma.notificationDelivery.count({
          where: {
            channel: NOTIFICATION_CHANNELS.PUSH,
            notification: { userId: user.id },
            createdAt: { gte: startOfISTDayUtc },
          },
        });

        const maxPushSetting = await SettingsService.get(
          SETTING_KEYS.NOTIFICATION_MAX_PUSH_PER_DAY,
          5,
        );

        const cap = userRole === ROLES.DRIVER ? maxPushSetting : userRole === ROLES.COMPANY ? 10 : 999;
        if (pushCountToday >= cap) {
          logger.info({ userId: user.id, pushCountToday, cap }, '[NotificationsService] Daily push cap reached, dropping push');
          targetChannels = targetChannels.filter((c) => c !== NOTIFICATION_CHANNELS.PUSH);
        }
      }

      // 2. Quiet hours
      if (targetChannels.includes(NOTIFICATION_CHANNELS.PUSH) && !isCritical && !params.forceImmediate) {
        const quietStart = user.notificationSettings?.quietHoursStart || '22:00';
        const quietEnd = user.notificationSettings?.quietHoursEnd || '07:00';

        if (isInQuietHours(now, quietStart, quietEnd)) {
          pushScheduledFor = getNextQuietHoursEnd(now, quietEnd);
          logger.info({ userId: user.id, pushScheduledFor }, '[NotificationsService] Quiet hours active, delaying push');
        }
      }
    }

    // Database transaction to persist notification and delivery rows
    const result = await prisma.$transaction(async (tx) => {
      const notification = await tx.notification.create({
        data: {
          userId: user.id,
          category: def.category as any,
          channel: NOTIFICATION_CHANNELS.IN_APP,
          priority: def.priority as any,
          title,
          body,
          data: (params.data ?? {}) as any,
          groupKey: def.key,
          dedupeKey: params.dedupeKey,
          status: NOTIFICATION_STATUS.SENT,
          sentAt: now,
        },
      });

      const deliveries: Array<{ id: string; channel: NotificationChannel; scheduledFor: Date | null }> = [];

      for (const ch of targetChannels) {
        const scheduled = ch === NOTIFICATION_CHANNELS.PUSH ? pushScheduledFor : null;
        const delivery = await tx.notificationDelivery.create({
          data: {
            notificationId: notification.id,
            channel: ch as any,
            status: DELIVERY_STATUS.PENDING as any,
            scheduledFor: scheduled,
          },
        });
        deliveries.push({ id: delivery.id, channel: ch, scheduledFor: scheduled });
      }

      return { notification, deliveries };
    });

    // Enqueue BullMQ delivery jobs
    for (const del of result.deliveries) {
      let delayMs = 0;
      if (del.scheduledFor && del.scheduledFor > now) {
        delayMs = Math.max(0, del.scheduledFor.getTime() - now.getTime());
      }

      const jobData: NotificationDeliveryJobData = {
        deliveryId: del.id,
        notificationId: result.notification.id,
        userId: user.id,
        channel: del.channel,
        attempt: 0,
      };

      await notificationDeliveryQueue.add('deliver', jobData, {
        delay: delayMs,
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      }).catch((err) => {
        logger.error({ err, deliveryId: del.id }, '[NotificationsService] Failed to enqueue delivery job');
      });
    }

    return {
      notificationId: result.notification.id,
      channels: targetChannels,
    };
  }

  // --- In-App Notifications List & State ---

  static async list(userId: string, options: { page?: number; limit?: number; unreadOnly?: boolean }) {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.max(1, Math.min(100, options.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (options.unreadOnly) {
      where.readAt = null;
    }

    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        userId: item.userId,
        category: item.category,
        channel: item.channel,
        priority: item.priority,
        title: item.title,
        body: item.body,
        data: item.data as Record<string, unknown> | null,
        groupKey: item.groupKey,
        status: item.status,
        sentAt: item.sentAt ? item.sentAt.toISOString() : null,
        readAt: item.readAt ? item.readAt.toISOString() : null,
        createdAt: item.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async markAsRead(userId: string, notificationId: string) {
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'Notification not found');
    }

    return prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  }

  static async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  static async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId, readAt: null },
    });
  }

  // --- Preferences & Settings ---

  static async getPreferences(userId: string) {
    const categories = Object.values(NOTIFICATION_CATEGORIES);
    const channels = Object.values(NOTIFICATION_CHANNELS);

    const userPrefs = await prisma.notificationPreference.findMany({
      where: { userId },
    });

    const prefMap = new Map<string, boolean>();
    userPrefs.forEach((p) => {
      prefMap.set(`${p.category}:${p.channel}`, p.enabled);
    });

    return categories.map((cat) => {
      const isLocked = cat === NOTIFICATION_CATEGORIES.DISCIPLINE || cat === NOTIFICATION_CATEGORIES.SYSTEM;
      return {
        category: cat,
        isLocked,
        channels: channels.map((ch) => ({
          channel: ch,
          enabled: prefMap.get(`${cat}:${ch}`) ?? true,
        })),
      };
    });
  }

  static async updatePreferences(
    userId: string,
    updates: Array<{ category: string; channel: string; enabled: boolean }>,
  ) {
    for (const item of updates) {
      if (item.category === NOTIFICATION_CATEGORIES.DISCIPLINE || item.category === NOTIFICATION_CATEGORIES.SYSTEM) {
        if (!item.enabled) {
          throw new AppError(
            ERROR_CODES.NOTIFICATION_CATEGORY_LOCKED,
            400,
            `Notifications for ${item.category} cannot be disabled`,
          );
        }
      }

      await prisma.notificationPreference.upsert({
        where: {
          userId_category_channel: {
            userId,
            category: item.category as any,
            channel: item.channel as any,
          },
        },
        create: {
          userId,
          category: item.category as any,
          channel: item.channel as any,
          enabled: item.enabled,
        },
        update: {
          enabled: item.enabled,
        },
      });
    }

    return this.getPreferences(userId);
  }

  static async getSettings(userId: string) {
    let settings = await prisma.userNotificationSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await prisma.userNotificationSettings.create({
        data: {
          userId,
          quietHoursStart: '22:00',
          quietHoursEnd: '07:00',
          language: 'en',
        },
      });
    }

    return {
      userId: settings.userId,
      quietHoursStart: settings.quietHoursStart,
      quietHoursEnd: settings.quietHoursEnd,
      language: settings.language,
    };
  }

  static async updateSettings(
    userId: string,
    data: { quietHoursStart?: string; quietHoursEnd?: string; language?: string },
  ) {
    const updated = await prisma.userNotificationSettings.upsert({
      where: { userId },
      create: {
        userId,
        quietHoursStart: data.quietHoursStart ?? '22:00',
        quietHoursEnd: data.quietHoursEnd ?? '07:00',
        language: data.language ?? 'en',
      },
      update: {
        ...(data.quietHoursStart && { quietHoursStart: data.quietHoursStart }),
        ...(data.quietHoursEnd && { quietHoursEnd: data.quietHoursEnd }),
        ...(data.language && { language: data.language }),
      },
    });

    if (data.language) {
      await prisma.user.update({
        where: { id: userId },
        data: { preferredLanguage: data.language },
      }).catch(() => null);
    }

    return updated;
  }

  // --- Device Tokens ---

  static async registerDevice(params: {
    userId: string;
    token: string;
    platform: 'ANDROID' | 'IOS' | 'WEB';
    provider?: 'EXPO' | 'FCM' | 'APNS';
    appVersion?: string;
  }) {
    return prisma.deviceToken.upsert({
      where: {
        userId_token: {
          userId: params.userId,
          token: params.token,
        },
      },
      create: {
        userId: params.userId,
        token: params.token,
        platform: params.platform as any,
        provider: (params.provider ?? 'EXPO') as any,
        appVersion: params.appVersion,
        disabledAt: null,
        lastRegisteredAt: new Date(),
        lastSeenAt: new Date(),
      },
      update: {
        platform: params.platform as any,
        provider: (params.provider ?? 'EXPO') as any,
        appVersion: params.appVersion,
        disabledAt: null,
        lastSeenAt: new Date(),
      },
    });
  }

  static async unregisterDevice(userId: string, token: string) {
    return prisma.deviceToken.updateMany({
      where: { userId, token },
      data: { disabledAt: new Date() },
    });
  }

  // --- Admin Stats & Retention ---

  static async getStats() {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [totalNotifications, deliveriesByChannel, deliveriesByStatus, last24hDeliveries] =
      await Promise.all([
        prisma.notification.count(),
        prisma.notificationDelivery.groupBy({
          by: ['channel'],
          _count: { id: true },
        }),
        prisma.notificationDelivery.groupBy({
          by: ['status'],
          _count: { id: true },
        }),
        prisma.notificationDelivery.count({
          where: { createdAt: { gte: last24h } },
        }),
      ]);

    const totalDeliveries = deliveriesByStatus.reduce((acc, curr) => acc + curr._count.id, 0);
    const deliveredCount =
      deliveriesByStatus.find((s) => s.status === DELIVERY_STATUS.DELIVERED)?._count.id ?? 0;
    const failedCount =
      deliveriesByStatus.find((s) => s.status === DELIVERY_STATUS.FAILED)?._count.id ?? 0;

    const deliveryRate = totalDeliveries > 0 ? (deliveredCount / totalDeliveries) * 100 : 100;
    const failureRate = totalDeliveries > 0 ? (failedCount / totalDeliveries) * 100 : 0;

    return {
      totalNotifications,
      totalDeliveries,
      last24hDeliveries,
      deliveryRatePercent: Number(deliveryRate.toFixed(2)),
      failureRatePercent: Number(failureRate.toFixed(2)),
      byChannel: Object.fromEntries(deliveriesByChannel.map((c) => [c.channel, c._count.id])),
      byStatus: Object.fromEntries(deliveriesByStatus.map((s) => [s.status, s._count.id])),
    };
  }

  static async purgeStale(retentionDays: number = 90): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    // Delete read or low-priority notifications older than cutoff
    const { count } = await prisma.notification.deleteMany({
      where: {
        createdAt: { lt: cutoff },
        OR: [{ readAt: { not: null } }, { priority: NOTIFICATION_PRIORITIES.NORMAL }],
      },
    });

    logger.info({ purgedCount: count, cutoff }, '[NotificationsService] Purged stale notifications');
    return count;
  }

  // --- Backwards Compatibility Helpers ---

  static async create(params: {
    userId: string;
    channel?: NotificationChannel;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }) {
    return prisma.notification.create({
      data: {
        userId: params.userId,
        channel: params.channel ?? NOTIFICATION_CHANNELS.IN_APP,
        title: params.title,
        body: params.body,
        data: (params.data ?? {}) as any,
        status: NOTIFICATION_STATUS.SENT,
        sentAt: new Date(),
      },
    });
  }

  static async sendKycApprovedNotification(userId: string) {
    return this.notify({
      key: 'kyc.approved',
      userId,
      data: { type: 'KYC_DECISION', decision: 'APPROVED' },
    });
  }

  static async sendKycRejectedNotification(userId: string, reasons: Array<{ note?: string; reasonCode: string }>) {
    const reasonText = reasons.map((r) => r.note || r.reasonCode).join('; ');
    return this.notify({
      key: 'kyc.rejected',
      userId,
      data: { reason: reasonText, type: 'KYC_DECISION', decision: 'REJECTED', reasons },
    });
  }

  static async sendKycNeedMoreInfoNotification(userId: string, reasons: Array<{ note?: string; reasonCode: string }>) {
    const reasonText = reasons.map((r) => r.note || r.reasonCode).join('; ');
    return this.notify({
      key: 'kyc.need_more_info',
      userId,
      data: { reason: reasonText, type: 'KYC_DECISION', decision: 'NEED_MORE_INFO', reasons },
    });
  }
}
