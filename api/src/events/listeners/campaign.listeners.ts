import { eventBus } from '../index.js';
import { NotificationsService } from '../../modules/notifications/notifications.service.js';
import { prisma } from '../../shared/db/index.js';
import { logger } from '../../shared/logger/index.js';

async function resolveCompanyUserId(companyId: string): Promise<string> {
  const company = await prisma.companyProfile.findUnique({
    where: { id: companyId },
    select: { userId: true },
  });
  return company?.userId ?? companyId;
}

export function registerCampaignEventListeners(): void {
  eventBus.on('campaign.submitted', async (event) => {
    logger.info({ campaignId: event.campaignId }, 'Handling campaign.submitted');
    try {
      const userId = await resolveCompanyUserId(event.companyId);
      await NotificationsService.notify({
        key: 'campaign.submitted',
        userId,
        data: {
          title: event.title,
          campaignId: event.campaignId,
        },
      });
    } catch (err) {
      logger.error({ err, campaignId: event.campaignId }, 'Failed to notify on campaign.submitted');
    }
  });

  eventBus.on('campaign.approved', async (event) => {
    logger.info({ campaignId: event.campaignId }, 'Handling campaign.approved');
    try {
      const userId = await resolveCompanyUserId(event.companyId);
      await NotificationsService.notify({
        key: 'campaign.approved',
        userId,
        data: {
          title: event.title,
          campaignId: event.campaignId,
        },
      });
    } catch (err) {
      logger.error({ err, campaignId: event.campaignId }, 'Failed to notify on campaign.approved');
    }
  });

  eventBus.on('campaign.rejected', async (event) => {
    logger.info({ campaignId: event.campaignId }, 'Handling campaign.rejected');
    try {
      const userId = await resolveCompanyUserId(event.companyId);
      const reasonsStr = event.reasons.map((r) => r.customNote || r.code).join(', ');
      await NotificationsService.notify({
        key: 'campaign.rejected',
        userId,
        data: {
          title: event.title,
          reason: reasonsStr,
          campaignId: event.campaignId,
        },
      });
    } catch (err) {
      logger.error({ err, campaignId: event.campaignId }, 'Failed to notify on campaign.rejected');
    }
  });

  eventBus.on('campaign.live', async (event) => {
    logger.info({ campaignId: event.campaignId }, 'Handling campaign.live');
    try {
      const userId = await resolveCompanyUserId(event.companyId);
      await NotificationsService.notify({
        key: 'campaign.live',
        userId,
        data: {
          title: event.title,
          campaignId: event.campaignId,
        },
      });
    } catch (err) {
      logger.error({ err, campaignId: event.campaignId }, 'Failed to notify on campaign.live');
    }
  });

  eventBus.on('campaign.running', async (event) => {
    logger.info({ campaignId: event.campaignId }, 'Handling campaign.running');
    try {
      const userId = await resolveCompanyUserId(event.companyId);
      await NotificationsService.notify({
        key: 'campaign.running',
        userId,
        data: {
          title: event.title,
          campaignId: event.campaignId,
        },
      });
    } catch (err) {
      logger.error({ err, campaignId: event.campaignId }, 'Failed to notify on campaign.running');
    }
  });

  eventBus.on('campaign.completed', async (event) => {
    logger.info({ campaignId: event.campaignId }, 'Handling campaign.completed');
    try {
      const userId = await resolveCompanyUserId(event.companyId);
      await NotificationsService.notify({
        key: 'campaign.completed',
        userId,
        data: {
          title: event.title,
          campaignId: event.campaignId,
        },
      });
    } catch (err) {
      logger.error({ err, campaignId: event.campaignId }, 'Failed to notify on campaign.completed');
    }
  });

  eventBus.on('campaign.expired', async (event) => {
    logger.info({ campaignId: event.campaignId }, 'Handling campaign.expired');
    try {
      const userId = await resolveCompanyUserId(event.companyId);
      await NotificationsService.notify({
        key: 'campaign.cancelled',
        userId,
        data: {
          title: event.title,
          reason: 'Payment deadline passed',
          campaignId: event.campaignId,
        },
      });
    } catch (err) {
      logger.error({ err, campaignId: event.campaignId }, 'Failed to notify on campaign.expired');
    }
  });

  eventBus.on('campaign.cancelled', async (event) => {
    logger.info({ campaignId: event.campaignId }, 'Handling campaign.cancelled');
    try {
      const userId = await resolveCompanyUserId(event.companyId);
      await NotificationsService.notify({
        key: 'campaign.cancelled',
        userId,
        data: {
          title: event.title,
          reason: event.reason,
          campaignId: event.campaignId,
        },
      });
    } catch (err) {
      logger.error({ err, campaignId: event.campaignId }, 'Failed to notify on campaign.cancelled');
    }
  });

  eventBus.on('campaign.enrolment_closed', async (event) => {
    logger.info({ campaignId: event.campaignId }, 'Handling campaign.enrolment_closed');
    try {
      const userId = await resolveCompanyUserId(event.companyId);
      await NotificationsService.notify({
        key: 'campaign.running',
        userId,
        data: {
          title: event.title,
          occupiedSlots: event.occupiedSlots,
          totalSlots: event.totalSlots,
          campaignId: event.campaignId,
        },
      });
    } catch (err) {
      logger.error({ err, campaignId: event.campaignId }, 'Failed to notify on campaign.enrolment_closed');
    }
  });
}
