import { prisma } from '../../shared/db/index.js';
import {
  CAMPAIGN_STATUS,
  ACTOR_TYPES,
  ERROR_CODES,
} from '@ap/shared-constants';
import { AppError } from '../../shared/errors/index.js';
import { campaignStateMachine } from './campaigns.state-machine.js';
import { AuditService } from '../audit/audit.service.js';
import { eventBus } from '../../events/index.js';
import { TimeService } from '../../shared/time/index.js';
import { logger } from '../../shared/logger/index.js';

export class CampaignPaymentBridge {
  /**
   * Marks a campaign as paid, transitioning it from AWAITING_PAYMENT to LIVE.
   * Executed by the real payment webhook in Phase 8, or the DEV simulation in Phase 5.
   */
  static async markPaid(campaignId: string, paymentRef: string) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new AppError(ERROR_CODES.CAMPAIGN_NOT_FOUND, 404, 'Campaign not found');
    }

    if (campaign.status !== CAMPAIGN_STATUS.AWAITING_PAYMENT) {
      throw new AppError(
        ERROR_CODES.CAMPAIGN_NOT_PAYABLE,
        400,
        `Cannot pay campaign with status ${campaign.status}. Expected AWAITING_PAYMENT.`,
      );
    }

    // Validate transition
    await campaignStateMachine.assertTransition(campaign.status, CAMPAIGN_STATUS.LIVE);

    const now = TimeService.now();

    // Idempotent conditional update
    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: CAMPAIGN_STATUS.LIVE,
        liveAt: now,
      },
    });

    // Write audit log
    await AuditService.log({
      actorId: 'system',
      actorType: ACTOR_TYPES.SYSTEM,
      action: 'campaign.paid',
      entityType: 'Campaign',
      entityId: campaignId,
      newValues: {
        status: CAMPAIGN_STATUS.LIVE,
        paymentRef,
        liveAt: now.toISOString(),
      },
    });

    logger.info({ campaignId, paymentRef }, 'Campaign successfully marked as paid and transitioned to LIVE');

    // Emit domain events
    eventBus.emit('campaign.paid', {
      campaignId: campaign.id,
      companyId: campaign.companyId,
      paymentRef,
      paidAt: now,
    });

    eventBus.emit('campaign.live', {
      campaignId: campaign.id,
      companyId: campaign.companyId,
      title: campaign.title,
      liveAt: now,
    });

    return updated;
  }
}
