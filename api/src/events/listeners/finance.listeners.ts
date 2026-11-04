import { eventBus } from '../index.js';
import { prisma } from '../../shared/db/index.js';
import { postInstallationAllowance } from '../../modules/ledger/recipes/index.js';
import { RefundService } from '../../modules/refunds/refund.service.js';
import { NotificationsService } from '../../modules/notifications/notifications.service.js';
import { REFUND_REASONS } from '@ap/shared-constants';
import { logger } from '../../shared/logger/index.js';

export function registerFinanceEventListeners(): void {
  // Step 4: Printing allowance credited to driver on installation approval
  eventBus.on('assignment.install_approved', async (event) => {
    logger.info(
      { assignmentId: event.assignmentId, driverId: event.driverId },
      'Processing printing allowance for install approval',
    );

    try {
      const assignment = await prisma.assignment.findUnique({
        where: { id: event.assignmentId },
        include: { campaign: true },
      });

      if (!assignment || assignment.printingAllowancePaid) {
        return;
      }

      const allowancePaise = BigInt(
        event.printingAllowancePaise ?? assignment.campaign.printingAllowancePaise,
      );

      if (allowancePaise > 0n) {
        await postInstallationAllowance({
          assignmentId: assignment.id,
          campaignId: assignment.campaignId,
          driverId: assignment.driverId,
          amountPaise: allowancePaise,
        });

        await prisma.assignment.update({
          where: { id: assignment.id },
          data: { printingAllowancePaid: true },
        });

        logger.info(
          { assignmentId: assignment.id, allowancePaise: allowancePaise.toString() },
          'Printing allowance successfully credited to driver wallet',
        );

        const driver = await prisma.driverProfile.findUnique({
          where: { id: event.driverId },
          select: { userId: true },
        });

        if (driver) {
          NotificationsService.notify({
            key: 'assignment.install_approved',
            userId: driver.userId,
            data: {
              title: assignment.campaign.title,
              allowance: Number(allowancePaise / 100n),
            },
          }).catch(() => null);
        }
      }
    } catch (err) {
      logger.error(
        { err, assignmentId: event.assignmentId },
        'Error posting printing allowance on install approved',
      );
    }
  });

  // Step 5: Refund unfilled slots when enrolment closes
  eventBus.on('campaign.enrolment_closed', async (event) => {
    logger.info(
      { campaignId: event.campaignId, unfilledSlots: event.unfilledSlots },
      'Processing unfilled slots refund on enrolment closed',
    );

    try {
      if (event.unfilledSlots <= 0) return;

      const campaign = await prisma.campaign.findUnique({
        where: { id: event.campaignId },
      });

      if (!campaign || campaign.targetAutoCount <= 0) return;

      // Calculate cost per slot from campaign total
      const perSlotChargedPaise = campaign.totalChargedPaise / BigInt(campaign.targetAutoCount);
      const refundAmountPaise = perSlotChargedPaise * BigInt(event.unfilledSlots);

      if (refundAmountPaise > 0n) {
        await RefundService.createAndExecuteSystemRefund(
          campaign.id,
          refundAmountPaise,
          REFUND_REASONS.UNFILLED_SLOTS,
          campaign.companyId,
          `Automated refund for ${event.unfilledSlots} unfilled slots`,
        );

        logger.info(
          { campaignId: campaign.id, refundAmountPaise: refundAmountPaise.toString() },
          'Unfilled slots refund successfully processed',
        );
      }
    } catch (err) {
      logger.error(
        { err, campaignId: event.campaignId },
        'Error executing unfilled slots refund on enrolment closed',
      );
    }
  });
}

