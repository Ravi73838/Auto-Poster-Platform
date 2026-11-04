import {
  SETTLEMENT_STATUS,
  ASSIGNMENT_STATUS,
  CAMPAIGN_STATUS,
  DAY_STATUS,
  SETTING_KEYS,
  type SettlementStatus,
} from '@ap/shared-constants';
import type { AssignmentSettlement, Campaign } from '@prisma/client';
import { prisma, withTransaction } from '../../shared/db/index.js';
import { SettingsService } from '../settings/settings.service.js';
import { postAssignmentSettlement, postCampaignCloseout } from '../ledger/recipes/index.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { AccountDirectory } from '../ledger/account-directory.js';
import {
  NotFoundError,
  ValidationError,
  AppError,
} from '../../shared/errors/index.js';
import { logger } from '../../shared/logger/index.js';

import { SettlementHoldProvider } from '../disputes/settlement-hold.provider.js';

export class SettlementService {
  /**
   * Calculates settlement metrics for an assignment.
   */
  static async calculateSettlement(
    assignmentId: string,
  ): Promise<AssignmentSettlement> {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        campaign: true,
        days: true,
        settlement: true,
      },
    });

    if (!assignment) {
      throw new NotFoundError(`Assignment ${assignmentId} not found`);
    }

    const totalDays = assignment.totalDays;
    const verifiedDays = assignment.days.filter((d) => d.status === DAY_STATUS.VERIFIED).length;
    const missedDays = assignment.days.filter((d) => d.status === DAY_STATUS.MISSED).length;
    const excusedDays = assignment.days.filter((d) => d.status === DAY_STATUS.EXCUSED).length;

    const defaultGraceDays = await SettingsService.get(
      SETTING_KEYS.SETTLEMENT_GRACE_DAYS_DEFAULT,
      3,
    );
    const graceDaysUsed = Math.min(missedDays, defaultGraceDays);
    const payableDays = Math.min(totalDays, verifiedDays + excusedDays + graceDaysUsed);

    const campaign = assignment.campaign;
    const targetAutoCount = BigInt(Math.max(1, campaign.targetAutoCount));

    // Calculate per-slot amounts in paise
    const rentTotalPaise = BigInt(campaign.dailyRentPaise) * BigInt(totalDays);
    const dailyRentPaise = BigInt(campaign.dailyRentPaise);
    const rentPayablePaise =
      totalDays > 0 ? (rentTotalPaise * BigInt(payableDays)) / BigInt(totalDays) : 0n;
    const companyRefundPaise = rentTotalPaise - rentPayablePaise;
    const printingAllowancePaise = BigInt(campaign.printingAllowancePaise);
    const commissionPaise = campaign.platformFeePaise / targetAutoCount;
    const gstPaise = campaign.gstAmountPaise / targetAutoCount;
    const totalAmountPaise =
      rentPayablePaise + companyRefundPaise + commissionPaise + gstPaise;

    // Detect anomaly flags
    const anomalyFlags: Record<string, boolean> = {};
    if (missedDays > 7) {
      anomalyFlags.excessive_missed_days = true;
    }
    if (verifiedDays === 0 && totalDays > 3) {
      anomalyFlags.zero_verified_days = true;
    }

    const hasDisputeHold = await SettlementHoldProvider.hasActiveHold(assignment.id);
    if (hasDisputeHold) {
      anomalyFlags.active_dispute = true;
    }

    const hasAnomalies = Object.keys(anomalyFlags).length > 0;
    const status: SettlementStatus = hasAnomalies
      ? SETTLEMENT_STATUS.HOLD
      : SETTLEMENT_STATUS.PENDING;

    const settlement = await prisma.assignmentSettlement.upsert({
      where: { assignmentId: assignment.id },
      create: {
        assignmentId: assignment.id,
        campaignId: campaign.id,
        driverId: assignment.driverId,
        status,
        totalDays,
        verifiedDays,
        missedDays,
        graceDaysUsed,
        payableDays,
        dailyRentPaise,
        rentPayablePaise,
        printingAllowancePaise,
        companyRefundPaise,
        commissionPaise,
        gstPaise,
        totalAmountPaise,
        anomalyFlags: hasAnomalies ? anomalyFlags : undefined,
        holdReason: hasAnomalies ? 'Flagged for excessive missed days' : null,
      },
      update: {
        totalDays,
        verifiedDays,
        missedDays,
        graceDaysUsed,
        payableDays,
        dailyRentPaise,
        rentPayablePaise,
        printingAllowancePaise,
        companyRefundPaise,
        commissionPaise,
        gstPaise,
        totalAmountPaise,
        anomalyFlags: hasAnomalies ? anomalyFlags : undefined,
      },
    });

    return settlement;
  }

  /**
   * Approves settlement and executes Recipe 3.
   */
  static async approveSettlement(
    settlementId: string,
    approvedById: string,
    overrideHold = false,
  ): Promise<AssignmentSettlement> {
    const settlement = await prisma.assignmentSettlement.findUnique({
      where: { id: settlementId },
      include: {
        assignment: true,
        campaign: true,
      },
    });

    if (!settlement) {
      throw new NotFoundError(`Settlement ${settlementId} not found`);
    }

    if (settlement.status === SETTLEMENT_STATUS.PAID) {
      return settlement;
    }

    if (settlement.status === SETTLEMENT_STATUS.HOLD && !overrideHold) {
      throw new AppError(
        'SETTLEMENT_ON_HOLD',
        `Settlement is on hold: ${settlement.holdReason ?? 'Manual review required'}`,
        400,
      );
    }

    return withTransaction(async (tx) => {
      // 1. Post Recipe 3: Assignment Settlement
      await postAssignmentSettlement(
        {
          assignmentId: settlement.assignmentId,
          campaignId: settlement.campaignId,
          driverId: settlement.driverId,
          rentPayablePaise: settlement.rentPayablePaise,
          companyRefundPaise: settlement.companyRefundPaise,
          commissionPaise: settlement.commissionPaise,
          gstPaise: settlement.gstPaise,
          metadata: { approvedById },
        },
        tx,
      );

      // 2. Update assignment status to PAID
      await tx.assignment.update({
        where: { id: settlement.assignmentId },
        data: {
          status: ASSIGNMENT_STATUS.PAID,
          rentPaidPaise: settlement.rentPayablePaise,
        },
      });

      // 3. Update settlement status to PAID
      const updated = await tx.assignmentSettlement.update({
        where: { id: settlement.id },
        data: {
          status: SETTLEMENT_STATUS.PAID,
          approvedById,
          approvedAt: new Date(),
        },
      });

      return updated;
    });
  }

  /**
   * Closes out a campaign when all assignments are settled and sweeps escrow to company refund.
   */
  static async closeoutCampaign(
    campaignId: string,
    adminUserId: string,
  ): Promise<{ campaign: Campaign; sweptAmountPaise: string }> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        assignments: true,
      },
    });

    if (!campaign) {
      throw new NotFoundError(`Campaign ${campaignId} not found`);
    }

    // Check that all enrolled assignments are settled or released
    const activeAssignments = campaign.assignments.filter(
      (a) =>
        a.status !== ASSIGNMENT_STATUS.PAID &&
        a.status !== ASSIGNMENT_STATUS.RELEASED &&
        a.status !== ASSIGNMENT_STATUS.TERMINATED &&
        a.status !== ASSIGNMENT_STATUS.RESERVATION_EXPIRED,
    );

    if (activeAssignments.length > 0) {
      throw new AppError(
        'ACTIVE_ASSIGNMENTS_EXIST',
        `Cannot close campaign: ${activeAssignments.length} assignment(s) are not settled`,
        400,
      );
    }

    const escrow = await AccountDirectory.getCampaignEscrowAccount(campaign.id);
    const escrowBalance = await LedgerService.getBalance(escrow.id);

    return withTransaction(async (tx) => {
      if (escrowBalance > 0n) {
        // Post Recipe 6: Closeout Sweep
        await postCampaignCloseout(
          {
            campaignId: campaign.id,
            amountPaise: escrowBalance,
            metadata: { closedBy: adminUserId },
          },
          tx,
        );
      }

      const updatedCampaign = await tx.campaign.update({
        where: { id: campaign.id },
        data: {
          status: CAMPAIGN_STATUS.SETTLED,
        },
      });

      return {
        campaign: updatedCampaign,
        sweptAmountPaise: escrowBalance.toString(),
      };
    });
  }
}

