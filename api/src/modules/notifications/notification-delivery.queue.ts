import { prisma } from '../../shared/db/index.js';
import { logger } from '../../shared/logger/index.js';
import {
  NOTIFICATION_CHANNELS,
  DELIVERY_STATUS,
  NOTIFICATION_PRIORITIES,
  SETTING_KEYS,
  type NotificationChannel,
  type Language,
} from '@ap/shared-constants';
import { getPushProvider } from '../../integrations/push/index.js';
import { getSmsProvider } from '../../integrations/sms/index.js';
import { getEmailProvider } from '../../integrations/email/index.js';
import { getNotificationDefinition } from './notification.registry.js';
import { SettingsService } from '../settings/settings.service.js';
import { isRecipientAllowlisted } from '../../shared/notifications/allowlist.js';

export const NOTIFICATION_DELIVERY_QUEUE_NAME = 'notification-delivery';

export interface NotificationDeliveryJobData {
  deliveryId: string;
  notificationId: string;
  userId: string;
  channel: NotificationChannel;
  attempt: number;
}

export const notificationDeliveryQueue = {
  name: NOTIFICATION_DELIVERY_QUEUE_NAME,
  add: async (
    _name: string,
    data: NotificationDeliveryJobData,
    opts?: { delay?: number; attempts?: number; backoff?: any; removeOnComplete?: any; removeOnFail?: any },
  ) => {
    const delay = opts?.delay || 0;
    const run = async () => {
      try {
        await processNotificationDelivery({ data } as any);
      } catch (err: any) {
        logger.error({ err: err?.message, deliveryId: data.deliveryId }, '[NotificationDelivery] In-memory job failed');
      }
    };

    if (delay > 0) {
      setTimeout(run, delay).unref();
    } else {
      setImmediate(run);
    }
  },
  close: async () => {},
};

export async function processNotificationDelivery(job: { data: NotificationDeliveryJobData }): Promise<void> {
  const { deliveryId, notificationId, userId, channel } = job.data;

  const delivery = await prisma.notificationDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      notification: true,
      deviceToken: true,
    },
  });

  if (!delivery) {
    logger.warn({ deliveryId }, '[NotificationDelivery] Delivery record not found, skipping');
    return;
  }

  if (delivery.status === DELIVERY_STATUS.DELIVERED) {
    logger.debug({ deliveryId }, '[NotificationDelivery] Already delivered, skipping');
    return;
  }

  const notification = delivery.notification;
  if (!notification) {
    logger.warn({ deliveryId, notificationId }, '[NotificationDelivery] Notification not found, skipping');
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, mobile: true, role: true },
  });

  if (!user) {
    logger.warn({ userId }, '[NotificationDelivery] User not found, skipping');
    await prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: DELIVERY_STATUS.FAILED,
        error: 'User not found',
        attempts: { increment: 1 },
      },
    });
    return;
  }

  const def = notification.groupKey ? getNotificationDefinition(notification.groupKey) : null;
  const data = (notification.data ?? {}) as Record<string, unknown>;

  try {
    switch (channel) {
      case NOTIFICATION_CHANNELS.IN_APP: {
        await prisma.notificationDelivery.update({
          where: { id: deliveryId },
          data: {
            status: DELIVERY_STATUS.DELIVERED,
            sentAt: new Date(),
            attempts: { increment: 1 },
          },
        });
        break;
      }

      case NOTIFICATION_CHANNELS.PUSH: {
        const pushProvider = getPushProvider();

        // If a specific device token was attached to the delivery
        let targetTokens: { id: string; token: string }[] = [];
        if (delivery.deviceToken && !delivery.deviceToken.disabledAt) {
          targetTokens = [{ id: delivery.deviceToken.id, token: delivery.deviceToken.token }];
        } else {
          // Fetch all active device tokens for the user
          const activeTokens = await prisma.deviceToken.findMany({
            where: {
              userId,
              disabledAt: null,
            },
          });
          targetTokens = activeTokens.map((t) => ({ id: t.id, token: t.token }));
        }

        if (targetTokens.length === 0) {
          await prisma.notificationDelivery.update({
            where: { id: deliveryId },
            data: {
              status: DELIVERY_STATUS.DELIVERED,
              error: 'No active device tokens (skipped)',
              sentAt: new Date(),
              attempts: { increment: 1 },
            },
          });
          return;
        }

        // Check notification allowlist in non-production
        const pushRecipient = user.mobile || user.email || '';
        if (!isRecipientAllowlisted(pushRecipient)) {
          logger.info(
            { userId, deliveryId, recipient: pushRecipient },
            '[NotificationDelivery] Push skipped: recipient not on NOTIFY_ALLOWLIST',
          );
          await prisma.notificationDelivery.update({
            where: { id: deliveryId },
            data: {
              status: DELIVERY_STATUS.DELIVERED,
              error: 'Recipient not on NOTIFY_ALLOWLIST (suppressed in non-production)',
              sentAt: new Date(),
              attempts: { increment: 1 },
            },
          });
          return;
        }

        const tickets = await pushProvider.send(
          targetTokens.map((t) => ({
            to: t.token,
            title: notification.title,
            body: notification.body,
            data: {
              ...data,
              notificationId: notification.id,
              groupKey: notification.groupKey,
            },
            priority: notification.priority === NOTIFICATION_PRIORITIES.URGENT ? 'high' : 'normal',
          })),
        );

        let hasSuccess = false;
        let lastTicketError = '';

        for (let i = 0; i < tickets.length; i++) {
          const ticket = tickets[i];
          if (!ticket) continue;
          const tokenRecord = targetTokens[i];

          if (ticket.status === 'ok') {
            hasSuccess = true;
          } else if (ticket.details?.error === 'DeviceNotRegistered' || ticket.details?.error === 'InvalidToken') {
            // Disable stale/unregistered token
            if (tokenRecord) {
              await prisma.deviceToken.update({
                where: { id: tokenRecord.id },
                data: { disabledAt: new Date() },
              }).catch(() => null);
            }
            lastTicketError = ticket.details.error;
          } else {
            lastTicketError = ticket.message || 'Push delivery failed';
          }
        }

        if (hasSuccess) {
          await prisma.notificationDelivery.update({
            where: { id: deliveryId },
            data: {
              status: DELIVERY_STATUS.DELIVERED,
              provider: 'expo',
              providerMessageId: tickets[0]?.id,
              sentAt: new Date(),
              attempts: { increment: 1 },
            },
          });
        } else {
          throw new Error(lastTicketError || 'All push tickets failed');
        }
        break;
      }

      case NOTIFICATION_CHANNELS.SMS: {
        if (!user.mobile) {
          await prisma.notificationDelivery.update({
            where: { id: deliveryId },
            data: {
              status: DELIVERY_STATUS.FAILED,
              error: 'User has no phone number registered',
              attempts: { increment: 1 },
            },
          });
          return;
        }

        // Check platform setting sms_enabled_events
        const smsEnabledEventsSetting = await SettingsService.get(
          SETTING_KEYS.SMS_ENABLED_EVENTS,
          [] as string[],
        ).catch(() => [] as string[]);
        const isSmsEnabled =
          notification.priority === NOTIFICATION_PRIORITIES.URGENT ||
          (Boolean(notification.groupKey) && (smsEnabledEventsSetting as string[]).includes(notification.groupKey!));

        if (!isSmsEnabled) {
          await prisma.notificationDelivery.update({
            where: { id: deliveryId },
            data: {
              status: DELIVERY_STATUS.DELIVERED,
              error: 'SMS channel not enabled for this event (skipped)',
              sentAt: new Date(),
              attempts: { increment: 1 },
            },
          });
          return;
        }

        // Check notification allowlist in non-production
        if (!isRecipientAllowlisted(user.mobile)) {
          logger.info(
            { userId, deliveryId, mobile: user.mobile },
            '[NotificationDelivery] SMS skipped: recipient not on NOTIFY_ALLOWLIST',
          );
          await prisma.notificationDelivery.update({
            where: { id: deliveryId },
            data: {
              status: DELIVERY_STATUS.DELIVERED,
              error: 'Recipient not on NOTIFY_ALLOWLIST (suppressed in non-production)',
              sentAt: new Date(),
              attempts: { increment: 1 },
            },
          });
          return;
        }

        const smsProvider = getSmsProvider();
        const templateKey = def?.smsTemplateId ?? 'DLT_OTP_LOGIN';

        await smsProvider.sendTemplate(
          user.mobile,
          templateKey,
          data as Record<string, string | number>,
          'en',
        );

        await prisma.notificationDelivery.update({
          where: { id: deliveryId },
          data: {
            status: DELIVERY_STATUS.DELIVERED,
            provider: 'sms',
            sentAt: new Date(),
            attempts: { increment: 1 },
          },
        });
        break;
      }

      case NOTIFICATION_CHANNELS.EMAIL: {
        if (!user.email) {
          await prisma.notificationDelivery.update({
            where: { id: deliveryId },
            data: {
              status: DELIVERY_STATUS.FAILED,
              error: 'User has no email address registered',
              attempts: { increment: 1 },
            },
          });
          return;
        }

        // Check notification allowlist in non-production
        if (!isRecipientAllowlisted(user.email)) {
          logger.info(
            { userId, deliveryId, email: user.email },
            '[NotificationDelivery] Email skipped: recipient not on NOTIFY_ALLOWLIST',
          );
          await prisma.notificationDelivery.update({
            where: { id: deliveryId },
            data: {
              status: DELIVERY_STATUS.DELIVERED,
              error: 'Recipient not on NOTIFY_ALLOWLIST (suppressed in non-production)',
              sentAt: new Date(),
              attempts: { increment: 1 },
            },
          });
          return;
        }

        const emailProvider = getEmailProvider();
        const templateKey = def?.emailTemplate ?? 'default';

        await emailProvider.sendTemplate(
          user.email,
          templateKey,
          {
            ...data,
            title: notification.title,
            body: notification.body,
          },
          'en',
        );

        await prisma.notificationDelivery.update({
          where: { id: deliveryId },
          data: {
            status: DELIVERY_STATUS.DELIVERED,
            provider: 'smtp',
            sentAt: new Date(),
            attempts: { increment: 1 },
          },
        });
        break;
      }
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error({ err, deliveryId, channel }, '[NotificationDelivery] Delivery error');

    const nextAttempts = (delivery.attempts ?? 0) + 1;
    const isTerminal = nextAttempts >= 3;

    await prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: isTerminal ? DELIVERY_STATUS.FAILED : DELIVERY_STATUS.PENDING,
        error: errorMsg,
        attempts: nextAttempts,
      },
    });

    if (!isTerminal) {
      throw err; // Trigger BullMQ retry
    }
  }
}

export function createNotificationDeliveryWorker() {
  return {
    close: async () => {},
    on: () => {},
  };
}
