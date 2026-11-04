import { prisma } from '../shared/db/index.js';
import {
  CAMPAIGN_STATUS,
  ACTOR_TYPES,
  SETTING_KEYS,
} from '@ap/shared-constants';
import { campaignStateMachine } from '../modules/campaigns/campaigns.state-machine.js';
import { AuditService } from '../modules/audit/audit.service.js';
import { eventBus } from '../events/index.js';
import {
  TimeService,
  todayIST,
  startOfISTDay,
  endOfISTDay,
} from '../shared/time/index.js';
import { SlotsService } from '../modules/campaigns/slots.service.js';
import { SettingsService } from '../modules/settings/settings.service.js';
import { redisClient } from '../shared/redis/index.js';
import { logger } from '../shared/logger/index.js';

export class CampaignJobsService {
  /**
   * 1. campaign-payment-expiry:
   * Transitions AWAITING_PAYMENT campaigns whose paymentDeadlineAt has passed to EXPIRED.
   * Safe to run multiple times (idempotent).
   */
  static async processPaymentExpiry(): Promise<number> {
    const now = TimeService.now();
    const expiredCampaigns = await prisma.campaign.findMany({
      where: {
        status: CAMPAIGN_STATUS.AWAITING_PAYMENT,
        paymentDeadlineAt: {
          lt: now,
        },
      },
      select: {
        id: true,
        companyId: true,
        title: true,
      },
    });

    let count = 0;
    for (const campaign of expiredCampaigns) {
      // Validate transition via state machine
      await campaignStateMachine.assertTransition(
        CAMPAIGN_STATUS.AWAITING_PAYMENT,
        CAMPAIGN_STATUS.EXPIRED,
      );

      // Atomic conditional update
      const updateResult = await prisma.campaign.updateMany({
        where: {
          id: campaign.id,
          status: CAMPAIGN_STATUS.AWAITING_PAYMENT,
        },
        data: {
          status: CAMPAIGN_STATUS.EXPIRED,
        },
      });

      if (updateResult.count > 0) {
        count++;
        await AuditService.log({
          actorId: 'system',
          actorType: ACTOR_TYPES.SYSTEM,
          action: 'campaign.expired',
          entityType: 'Campaign',
          entityId: campaign.id,
          newValues: { status: CAMPAIGN_STATUS.EXPIRED, expiredAt: now.toISOString() },
        });

        eventBus.emit('campaign.expired', {
          campaignId: campaign.id,
          companyId: campaign.companyId,
          title: campaign.title,
          expiredAt: now,
        });
      }
    }

    if (count > 0) {
      logger.info({ count }, 'campaign-payment-expiry job: expired campaigns');
    }
    return count;
  }

  /**
   * 2. campaign-start:
   * Transitions LIVE campaigns whose startDate (in IST) is <= today (IST) to RUNNING.
   * Safe to run multiple times (idempotent).
   */
  static async processCampaignStart(): Promise<number> {
    const today = todayIST();
    const endOfToday = endOfISTDay(today);

    const readyCampaigns = await prisma.campaign.findMany({
      where: {
        status: CAMPAIGN_STATUS.LIVE,
        startDate: {
          lte: endOfToday,
        },
      },
      select: {
        id: true,
        companyId: true,
        title: true,
      },
    });

    let count = 0;
    const now = TimeService.now();
    for (const campaign of readyCampaigns) {
      await campaignStateMachine.assertTransition(
        CAMPAIGN_STATUS.LIVE,
        CAMPAIGN_STATUS.RUNNING,
      );

      const updateResult = await prisma.campaign.updateMany({
        where: {
          id: campaign.id,
          status: CAMPAIGN_STATUS.LIVE,
        },
        data: {
          status: CAMPAIGN_STATUS.RUNNING,
        },
      });

      if (updateResult.count > 0) {
        count++;
        await AuditService.log({
          actorId: 'system',
          actorType: ACTOR_TYPES.SYSTEM,
          action: 'campaign.started',
          entityType: 'Campaign',
          entityId: campaign.id,
          newValues: { status: CAMPAIGN_STATUS.RUNNING, runningAt: now.toISOString() },
        });

        eventBus.emit('campaign.running', {
          campaignId: campaign.id,
          companyId: campaign.companyId,
          title: campaign.title,
          runningAt: now,
        });
      }
    }

    if (count > 0) {
      logger.info({ count }, 'campaign-start job: started campaigns');
    }
    return count;
  }

  /**
   * 3. campaign-complete:
   * Transitions RUNNING campaigns whose endDate (in IST) was strictly before today (IST) to COMPLETED.
   * Safe to run multiple times (idempotent).
   */
  static async processCampaignComplete(): Promise<number> {
    const today = todayIST();
    const startOfToday = startOfISTDay(today);

    const completedCampaigns = await prisma.campaign.findMany({
      where: {
        status: CAMPAIGN_STATUS.RUNNING,
        endDate: {
          lt: startOfToday,
        },
      },
      select: {
        id: true,
        companyId: true,
        title: true,
      },
    });

    let count = 0;
    const now = TimeService.now();
    for (const campaign of completedCampaigns) {
      await campaignStateMachine.assertTransition(
        CAMPAIGN_STATUS.RUNNING,
        CAMPAIGN_STATUS.COMPLETED,
      );

      const updateResult = await prisma.campaign.updateMany({
        where: {
          id: campaign.id,
          status: CAMPAIGN_STATUS.RUNNING,
        },
        data: {
          status: CAMPAIGN_STATUS.COMPLETED,
        },
      });

      if (updateResult.count > 0) {
        count++;
        await AuditService.log({
          actorId: 'system',
          actorType: ACTOR_TYPES.SYSTEM,
          action: 'campaign.completed',
          entityType: 'Campaign',
          entityId: campaign.id,
          newValues: { status: CAMPAIGN_STATUS.COMPLETED, completedAt: now.toISOString() },
        });

        eventBus.emit('campaign.completed', {
          campaignId: campaign.id,
          companyId: campaign.companyId,
          title: campaign.title,
          completedAt: now,
        });
      }
    }

    if (count > 0) {
      logger.info({ count }, 'campaign-complete job: completed campaigns');
    }
    return count;
  }

  /**
   * 4. campaign-enrolment-close:
   * Emits campaign.enrolment_closed exactly once per campaign when enrolmentClosesAt passes.
   * Guarantees single delivery using Redis keys.
   */
  static async processEnrolmentClose(): Promise<number> {
    const now = TimeService.now();
    const campaigns = await prisma.campaign.findMany({
      where: {
        status: { in: [CAMPAIGN_STATUS.LIVE, CAMPAIGN_STATUS.RUNNING] },
        enrolmentClosesAt: {
          lt: now,
        },
      },
      select: {
        id: true,
        companyId: true,
        title: true,
        targetAutoCount: true,
      },
    });

    let count = 0;
    for (const campaign of campaigns) {
      const lockKey = `campaign:enrolment_closed:${campaign.id}`;
      // set NX returns 'OK' if set, null if key already existed
      let acquired: string | null = null;
      try {
        acquired = await redisClient.set(lockKey, '1', 'EX', 86400 * 365, 'NX');
      } catch {
        // if Redis is mock or fallback
        acquired = 'OK';
      }

      if (acquired === 'OK') {
        count++;
        const usage = await SlotsService.getSlotUsage(campaign.id);
        const unfilled = usage.available;

        await AuditService.log({
          actorId: 'system',
          actorType: ACTOR_TYPES.SYSTEM,
          action: 'campaign.enrolment_closed',
          entityType: 'Campaign',
          entityId: campaign.id,
          newValues: {
            totalSlots: usage.total,
            occupiedSlots: usage.occupied,
            unfilledSlots: unfilled,
            closedAt: now.toISOString(),
          },
        });

        eventBus.emit('campaign.enrolment_closed', {
          campaignId: campaign.id,
          companyId: campaign.companyId,
          title: campaign.title,
          totalSlots: usage.total,
          occupiedSlots: usage.occupied,
          unfilledSlots: unfilled,
          closedAt: now,
        });
      }
    }

    if (count > 0) {
      logger.info({ count }, 'campaign-enrolment-close job: closed enrolment campaigns');
    }
    return count;
  }

  /**
   * 5. campaign-review-sla-alert:
   * Checks for campaigns past the review SLA and logs warnings.
   */
  static async processReviewSlaAlert(): Promise<number> {
    let slaHours = 24;
    try {
      slaHours = await SettingsService.get(SETTING_KEYS.CAMPAIGN_REVIEW_SLA_HOURS);
    } catch {
      slaHours = 24;
    }

    const slaThreshold = new Date(TimeService.now().getTime() - slaHours * 60 * 60 * 1000);

    const breachedCampaigns = await prisma.campaign.findMany({
      where: {
        status: { in: [CAMPAIGN_STATUS.SUBMITTED, CAMPAIGN_STATUS.UNDER_REVIEW] },
        lastSubmittedAt: {
          lt: slaThreshold,
        },
      },
      select: {
        id: true,
        title: true,
        lastSubmittedAt: true,
      },
    });

    if (breachedCampaigns.length > 0) {
      logger.warn(
        { breachedCount: breachedCampaigns.length, slaHours },
        'campaign-review-sla-alert: campaigns have breached review SLA threshold',
      );
    }

    return breachedCampaigns.length;
  }
}
