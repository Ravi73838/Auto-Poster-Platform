import { prisma } from '../../shared/db/index.js';
import {
  DISPUTE_STATUS,
  LEDGER_DIRECTIONS,
  LEDGER_REF_TYPES,
  ERROR_CODES,
} from '@ap/shared-constants';
import { AppError } from '../../shared/errors/app-error.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { AccountDirectory } from '../ledger/account-directory.js';
import { logger } from '../../shared/logger/index.js';

export class SettlementHoldProvider {
  /**
   * Sums heldAmountPaise for all active disputes associated with an assignment.
   */
  static async getHeldAmount(assignmentOrCampaignId: string): Promise<bigint> {
    const disputes = await prisma.dispute.findMany({
      where: {
        OR: [
          { assignmentId: assignmentOrCampaignId },
          { campaignId: assignmentOrCampaignId },
          { assignment: { campaignId: assignmentOrCampaignId } },
        ],
        status: { in: [DISPUTE_STATUS.OPEN, DISPUTE_STATUS.UNDER_REVIEW] },
      },
      select: { heldAmountPaise: true },
    });

    return disputes.reduce((sum, d) => sum + BigInt(d.heldAmountPaise ?? 0), 0n);
  }

  /**
   * Returns true if there are any active holds on the assignment or campaign.
   */
  static async hasActiveHold(assignmentOrCampaignId: string): Promise<boolean> {
    const held = await this.getHeldAmount(assignmentOrCampaignId);
    return held > 0n;
  }

  /**
   * Releases held money to either DRIVER (wallet) or COMPANY (refund) via balanced ledger double-entry.
   */
  static async releaseHeld(params: {
    disputeId: string;
    toParty: 'DRIVER' | 'COMPANY';
    amountPaise: bigint;
    tx?: any;
  }): Promise<void> {
    const runInTx = async (tx: any) => {
      const dispute = await tx.dispute.findUnique({
        where: { id: params.disputeId },
        include: {
          assignment: {
            include: { campaign: true, driver: true },
          },
        },
      });

      if (!dispute) {
        throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'Dispute not found');
      }

      if (!dispute.campaignId && !dispute.assignment?.campaignId) {
        throw new AppError(
          ERROR_CODES.VALIDATION_ERROR,
          400,
          'Cannot release held money: Dispute has no associated campaign',
        );
      }

      const campaignId = dispute.campaignId ?? dispute.assignment!.campaignId;
      const driverId = dispute.assignment?.driverId ?? dispute.raisedByUserId;
      const amountPaise = params.amountPaise;

      if (amountPaise <= 0n) {
        return;
      }

      const escrowAccount = await AccountDirectory.getCampaignEscrowAccount(campaignId, tx);

      if (params.toParty === 'DRIVER') {
        const driverAccount = await AccountDirectory.getDriverWalletAccount(driverId, tx);

        await LedgerService.postTransaction(
          {
            refType: LEDGER_REF_TYPES.ADJUSTMENT,
            refId: dispute.id,
            description: `Dispute #${dispute.id} resolution: Release hold to driver`,
            idempotencyKey: `dispute:${dispute.id}:release:driver:${amountPaise}`,
            entries: [
              {
                accountId: escrowAccount.id,
                direction: LEDGER_DIRECTIONS.DEBIT,
                amountPaise,
              },
              {
                accountId: driverAccount.id,
                direction: LEDGER_DIRECTIONS.CREDIT,
                amountPaise,
              },
            ],
          },
          tx,
        );
      } else {
        const companyRefundAccount = await AccountDirectory.getCompanyRefundAccount(tx);

        await LedgerService.postTransaction(
          {
            refType: LEDGER_REF_TYPES.ADJUSTMENT,
            refId: dispute.id,
            description: `Dispute #${dispute.id} resolution: Release hold to company refund`,
            idempotencyKey: `dispute:${dispute.id}:release:company:${amountPaise}`,
            entries: [
              {
                accountId: escrowAccount.id,
                direction: LEDGER_DIRECTIONS.DEBIT,
                amountPaise,
              },
              {
                accountId: companyRefundAccount.id,
                direction: LEDGER_DIRECTIONS.CREDIT,
                amountPaise,
              },
            ],
          },
          tx,
        );
      }

      // Clear dispute held amount
      await tx.dispute.update({
        where: { id: dispute.id },
        data: { heldAmountPaise: 0n },
      });

      logger.info(
        { disputeId: dispute.id, toParty: params.toParty, amountPaise: amountPaise.toString() },
        '[SettlementHoldProvider] Released held funds via double-entry transaction',
      );
    };

    if (params.tx) {
      await runInTx(params.tx);
    } else {
      await prisma.$transaction(runInTx);
    }
  }
}
