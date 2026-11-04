import {
  ASSIGNMENT_STATUS,
  CAMPAIGN_STATUS,
  REFUND_STATUS,
  SETTLEMENT_STATUS,
} from '@ap/shared-constants';
import { prisma } from '../shared/db/index.js';
import { postInstallationAllowance } from '../modules/ledger/recipes/index.js';
import { SettlementService } from '../modules/settlements/settlement.service.js';
import { RefundService } from '../modules/refunds/refund.service.js';
import { LedgerInvariantService } from '../modules/ledger/ledger-invariant.service.js';
import { SettingsService } from '../modules/settings/settings.service.js';
import { SETTING_KEYS } from '@ap/shared-constants';
import { logger } from '../shared/logger/index.js';

export class MoneyJobsService {
  /**
   * Credits printing allowance for any approved installations that were missed.
   */
  static async allowanceBackfill(): Promise<{ processed: number }> {
    logger.info('Running allowance backfill job...');
    const missedAssignments = await prisma.assignment.findMany({
      where: {
        status: {
          in: [
            ASSIGNMENT_STATUS.INSTALL_APPROVED,
            ASSIGNMENT_STATUS.RUNNING,
            ASSIGNMENT_STATUS.COMPLETED,
            ASSIGNMENT_STATUS.PAID,
          ],
        },
        printingAllowancePaid: false,
      },
      include: { campaign: true },
    });

    let processed = 0;
    for (const assignment of missedAssignments) {
      try {
        const allowancePaise = BigInt(assignment.campaign.printingAllowancePaise);
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
          processed++;
        }
      } catch (err) {
        logger.error(
          { err, assignmentId: assignment.id },
          'Error backfilling printing allowance',
        );
      }
    }

    return { processed };
  }

  /**
   * Generates settlements for completed assignments.
   */
  static async settlementTrigger(): Promise<{ processed: number }> {
    logger.info('Running settlement trigger job...');
    const delayDays = await SettingsService.get(
      SETTING_KEYS.SETTLEMENT_DELAY_DAYS,
      3,
    );

    const now = new Date();
    const delayCutoff = new Date(now.getTime() - delayDays * 24 * 60 * 60 * 1000);

    const completedAssignments = await prisma.assignment.findMany({
      where: {
        status: ASSIGNMENT_STATUS.COMPLETED,
        settlement: null,
        updatedAt: { lte: delayCutoff },
      },
    });

    let processed = 0;
    for (const assignment of completedAssignments) {
      try {
        await SettlementService.calculateSettlement(assignment.id);
        processed++;
      } catch (err) {
        logger.error(
          { err, assignmentId: assignment.id },
          'Error generating settlement for completed assignment',
        );
      }
    }

    return { processed };
  }

  /**
   * Sweeps escrow for campaigns where all assignments are finished.
   */
  static async closeoutTrigger(): Promise<{ processed: number }> {
    logger.info('Running closeout trigger job...');
    const completedCampaigns = await prisma.campaign.findMany({
      where: {
        status: CAMPAIGN_STATUS.COMPLETED,
      },
      include: {
        assignments: {
          select: { status: true },
        },
      },
    });

    let processed = 0;
    for (const campaign of completedCampaigns) {
      const allSettled = campaign.assignments.every(
        (a) =>
          a.status === ASSIGNMENT_STATUS.PAID ||
          a.status === ASSIGNMENT_STATUS.RELEASED ||
          a.status === ASSIGNMENT_STATUS.TERMINATED ||
          a.status === ASSIGNMENT_STATUS.RESERVATION_EXPIRED,
      );

      if (allSettled) {
        try {
          await SettlementService.closeoutCampaign(campaign.id, campaign.companyId);
          processed++;
        } catch (err) {
          logger.error({ err, campaignId: campaign.id }, 'Error running campaign closeout sweep');
        }
      }
    }

    return { processed };
  }

  /**
   * Retries processing refunds that are in PROCESSING or FAILED status.
   */
  static async refundRetry(): Promise<{ processed: number }> {
    logger.info('Running refund retry job...');
    const pendingRefunds = await prisma.refund.findMany({
      where: { status: REFUND_STATUS.PROCESSING },
      include: { payment: true },
    });

    let processed = 0;
    for (const refund of pendingRefunds) {
      try {
        if (refund.approvedById) {
          await RefundService.approveRefund(refund.id, refund.approvedById);
          processed++;
        }
      } catch (err) {
        logger.error({ err, refundId: refund.id }, 'Error retrying refund execution');
      }
    }

    return { processed };
  }

  /**
   * Runs daily reconciliation check and saves record to ReconciliationRun table.
   */
  static async reconciliationCheck(): Promise<{ isBalanced: boolean; diffPaise: string }> {
    logger.info('Running daily reconciliation check...');
    const trialBalance = await LedgerInvariantService.verifyTrialBalance();

    await prisma.reconciliationRun.create({
      data: {
        runDate: new Date(),
        status: trialBalance.isBalanced ? 'BALANCED' : 'UNBALANCED',
        trialBalanceDiffPaise: trialBalance.diffPaise,
        anomaliesFound: trialBalance.isBalanced ? 0 : 1,
        details: {
          totalDebitsPaise: trialBalance.totalDebitsPaise.toString(),
          totalCreditsPaise: trialBalance.totalCreditsPaise.toString(),
          accountsCount: trialBalance.accounts.length,
        },
      },
    });

    return {
      isBalanced: trialBalance.isBalanced,
      diffPaise: trialBalance.diffPaise.toString(),
    };
  }
}

