import {
  LEDGER_ACCOUNT_TYPES,
  LEDGER_DIRECTIONS,
  PAYMENT_STATUS,
  PAYOUT_STATUS,
  REFUND_STATUS,
  SETTLEMENT_STATUS,
  SETTING_KEYS,
  PAYOUT_PROVIDER_NAMES,
  ADJUSTMENT_STATUS,
  type PayoutStatus,
  type SettlementStatus,
  type RefundStatus,
} from '@ap/shared-constants';
import type {
  CampaignPayment,
  Refund,
  AssignmentSettlement,
  Payout,
  PayoutBatch,
  Adjustment,
  LedgerAccount,
} from '@prisma/client';
import { prisma, withTransaction, type PaginationParams, paginateQuery, getPaginationMeta } from '../../../shared/db/index.js';
import { SettingsService } from '../../settings/settings.service.js';
import { AccountDirectory } from '../../ledger/account-directory.js';
import { LedgerService } from '../../ledger/ledger.service.js';
import { LedgerInvariantService } from '../../ledger/ledger-invariant.service.js';
import { postManualAdjustment, postPayoutComplete, postPayoutReversal } from '../../ledger/recipes/index.js';
import { ManualPayoutProvider } from '../../../integrations/payout/index.js';
import { RefundService } from '../../refunds/refund.service.js';
import { SettlementService } from '../../settlements/settlement.service.js';
import {
  NotFoundError,
  ValidationError,
  AppError,
} from '../../../shared/errors/index.js';
import type {
  FinanceDashboardDto,
  TrialBalanceDto,
} from '@ap/shared-types';
import type {
  AdjustmentRequestInput,
  AdjustmentReviewInput,
  FinancePauseInput,
  RefundRequestInput,
  RefundReviewInput,
  SettlementApprovalInput,
} from '@ap/shared-validation';

export class AdminFinanceService {
  /**
   * Retrieves finance dashboard metrics.
   */
  static async getDashboard(): Promise<FinanceDashboardDto> {
    const clearingAcc = await AccountDirectory.getGatewayClearingAccount();
    const feesAcc = await AccountDirectory.getGatewayFeesAccount();
    const revAcc = await AccountDirectory.getPlatformRevenueAccount();
    const gstAcc = await AccountDirectory.getGstPayableAccount();
    const inTransitAcc = await AccountDirectory.getPayoutInTransitAccount();
    const refundAcc = await AccountDirectory.getCompanyRefundAccount();

    const [
      gatewayClearingPaise,
      gatewayFeesPaise,
      platformRevenuePaise,
      gstPayablePaise,
      payoutInTransitPaise,
      companyRefundPaise,
      pendingSettlementsCount,
      pendingPayoutsCount,
      pendingRefundsCount,
      paymentsEnabled,
      payoutsEnabled,
    ] = await Promise.all([
      LedgerService.getBalance(clearingAcc.id),
      LedgerService.getBalance(feesAcc.id),
      LedgerService.getBalance(revAcc.id),
      LedgerService.getBalance(gstAcc.id),
      LedgerService.getBalance(inTransitAcc.id),
      LedgerService.getBalance(refundAcc.id),
      prisma.assignmentSettlement.count({
        where: { status: { in: [SETTLEMENT_STATUS.PENDING, SETTLEMENT_STATUS.HOLD] } },
      }),
      prisma.payout.count({
        where: { status: { in: [PAYOUT_STATUS.PENDING, PAYOUT_STATUS.APPROVED] } },
      }),
      prisma.refund.count({
        where: { status: REFUND_STATUS.PENDING },
      }),
      SettingsService.get(SETTING_KEYS.FINANCE_PAYMENTS_ENABLED, true),
      SettingsService.get(SETTING_KEYS.FINANCE_PAYOUTS_ENABLED, true),
    ]);

    // Aggregate all escrow accounts
    const escrowAccounts = await prisma.ledgerAccount.findMany({
      where: { accountType: LEDGER_ACCOUNT_TYPES.CAMPAIGN_ESCROW },
      select: { id: true },
    });
    let escrowBalancePaise = 0n;
    for (const acc of escrowAccounts) {
      escrowBalancePaise += await LedgerService.getBalance(acc.id);
    }

    // Aggregate all driver wallet accounts
    const walletAccounts = await prisma.ledgerAccount.findMany({
      where: { accountType: LEDGER_ACCOUNT_TYPES.DRIVER_WALLET },
      select: { id: true },
    });
    let driverWalletBalancePaise = 0n;
    for (const acc of walletAccounts) {
      driverWalletBalancePaise += await LedgerService.getBalance(acc.id);
    }

    return {
      escrowBalancePaise: escrowBalancePaise.toString(),
      driverWalletBalancePaise: driverWalletBalancePaise.toString(),
      payoutInTransitPaise: payoutInTransitPaise.toString(),
      platformRevenuePaise: platformRevenuePaise.toString(),
      gstPayablePaise: gstPayablePaise.toString(),
      companyRefundPaise: companyRefundPaise.toString(),
      gatewayClearingPaise: gatewayClearingPaise.toString(),
      gatewayFeesPaise: gatewayFeesPaise.toString(),
      pendingSettlementsCount,
      pendingPayoutsCount,
      pendingRefundsCount,
      paymentsEnabled,
      payoutsEnabled,
    };
  }

  /**
   * Toggles master pause switches.
   */
  static async togglePause(input: FinancePauseInput, adminId: string): Promise<{ paymentsEnabled: boolean; payoutsEnabled: boolean }> {
    if (input.paymentsEnabled !== undefined) {
      await SettingsService.set(
        SETTING_KEYS.FINANCE_PAYMENTS_ENABLED,
        input.paymentsEnabled,
        adminId,
      );
    }
    if (input.payoutsEnabled !== undefined) {
      await SettingsService.set(
        SETTING_KEYS.FINANCE_PAYOUTS_ENABLED,
        input.payoutsEnabled,
        adminId,
      );
    }

    return {
      paymentsEnabled: await SettingsService.get(SETTING_KEYS.FINANCE_PAYMENTS_ENABLED, true),
      payoutsEnabled: await SettingsService.get(SETTING_KEYS.FINANCE_PAYOUTS_ENABLED, true),
    };
  }

  /**
   * Creates a manual adjustment request against SYS_ADJUSTMENT.
   */
  static async requestAdjustment(
    input: AdjustmentRequestInput,
    requestedById: string,
  ): Promise<Adjustment> {
    const account = await prisma.ledgerAccount.findUnique({
      where: { id: input.accountId },
    });

    if (!account) {
      throw new NotFoundError(`Ledger account ${input.accountId} not found`);
    }

    return prisma.adjustment.create({
      data: {
        accountId: input.accountId,
        amountPaise: BigInt(input.amountPaise),
        direction: input.direction,
        reason: input.reason,
        status: ADJUSTMENT_STATUS.PENDING,
        requestedById,
        idempotencyKey: input.idempotencyKey ?? `adj:${input.accountId}:${Date.now()}`,
      },
    });
  }

  /**
   * Reviews and executes a manual adjustment with Maker-Checker dual-approval.
   */
  static async reviewAdjustment(
    adjustmentId: string,
    input: AdjustmentReviewInput,
    reviewerId: string,
  ): Promise<Adjustment> {
    const adjustment = await prisma.adjustment.findUnique({
      where: { id: adjustmentId },
    });

    if (!adjustment) {
      throw new NotFoundError(`Adjustment ${adjustmentId} not found`);
    }

    if (adjustment.status !== ADJUSTMENT_STATUS.PENDING) {
      throw new AppError('ADJUSTMENT_ALREADY_PROCESSED', 'Adjustment is not pending review', 400);
    }

    // Maker-checker dual approval enforcement!
    if (adjustment.requestedById === reviewerId) {
      throw new AppError(
        'MAKER_CHECKER_VIOLATION',
        'Maker-checker violation: Requester and approver must be different administrators',
        403,
      );
    }

    if (input.decision === 'REJECTED') {
      return prisma.adjustment.update({
        where: { id: adjustment.id },
        data: {
          status: ADJUSTMENT_STATUS.REJECTED,
          rejectedById: reviewerId,
          rejectionReason: input.rejectionReason,
        },
      });
    }

    // Approved: Execute Recipe 8
    return withTransaction(async (tx) => {
      const ledgerTx = await postManualAdjustment(
        {
          adjustmentId: adjustment.id,
          targetAccountId: adjustment.accountId,
          direction: adjustment.direction,
          amountPaise: adjustment.amountPaise,
          reason: adjustment.reason,
          metadata: { approvedById: reviewerId },
        },
        tx,
      );

      return tx.adjustment.update({
        where: { id: adjustment.id },
        data: {
          status: ADJUSTMENT_STATUS.EXECUTED,
          approvedById: reviewerId,
          transactionId: ledgerTx.id,
        },
      });
    });
  }

  /**
   * Exports approved payouts into a PayoutBatch and generates CSV.
   */
  static async exportPayoutBatch(adminId: string): Promise<{ batch: PayoutBatch; csv: string }> {
    const payouts = await prisma.payout.findMany({
      where: { status: PAYOUT_STATUS.APPROVED, batchId: null },
      orderBy: { requestedAt: 'asc' },
    });

    if (payouts.length === 0) {
      throw new ValidationError('No approved payouts pending batch export');
    }

    const batchNumber = `BATCH_${Date.now()}`;
    const totalCount = payouts.length;
    const totalAmountPaise = payouts.reduce((sum, p) => sum + p.amountPaise, 0n);

    const csv = ManualPayoutProvider.generatePayoutCsv(payouts);

    const batch = await withTransaction(async (tx) => {
      const createdBatch = await tx.payoutBatch.create({
        data: {
          batchNumber,
          provider: PAYOUT_PROVIDER_NAMES.MANUAL_CSV,
          totalCount,
          totalAmountPaise,
          status: 'EXPORTED',
        },
      });

      await tx.payout.updateMany({
        where: { id: { in: payouts.map((p) => p.id) } },
        data: {
          batchId: createdBatch.id,
          status: PAYOUT_STATUS.PROCESSING,
        },
      });

      return createdBatch;
    });

    return { batch, csv };
  }

  /**
   * Imports bank result CSV and processes payouts.
   */
  static async importPayoutCsvResult(
    csvContent: string,
    adminId: string,
  ): Promise<{ processed: number; succeeded: number; failed: number }> {
    const rows = ManualPayoutProvider.parseResultCsv(csvContent);
    let succeeded = 0;
    let failed = 0;

    for (const row of rows) {
      const payout = await prisma.payout.findUnique({
        where: { id: row.payoutId },
      });

      if (!payout || payout.status === PAYOUT_STATUS.PAID) {
        continue;
      }

      if (row.status === 'SUCCESS' || row.status === 'PAID') {
        await withTransaction(async (tx) => {
          // Recipe 5B: DR PAYOUT_IN_TRANSIT, CR GATEWAY_CLEARING
          await postPayoutComplete(
            {
              payoutId: payout.id,
              amountPaise: payout.amountPaise,
            },
            tx,
          );

          await tx.payout.update({
            where: { id: payout.id },
            data: {
              status: PAYOUT_STATUS.PAID,
              utr: row.utr ?? null,
              processedAt: new Date(),
            },
          });
        });
        succeeded++;
      } else {
        // Failed: Recipe 5C: DR PAYOUT_IN_TRANSIT, CR DRIVER_WALLET (reversal)
        await withTransaction(async (tx) => {
          await postPayoutReversal(
            {
              payoutId: payout.id,
              driverId: payout.driverId,
              amountPaise: payout.amountPaise,
              reason: row.failureReason ?? 'Bank rejected transaction',
            },
            tx,
          );

          await tx.payout.update({
            where: { id: payout.id },
            data: {
              status: PAYOUT_STATUS.FAILED,
              failureReason: row.failureReason ?? 'Bank rejected transaction',
              processedAt: new Date(),
            },
          });
        });
        failed++;
      }
    }

    return {
      processed: rows.length,
      succeeded,
      failed,
    };
  }

  /**
   * Retrieves global trial balance verifying debits equal credits across all accounts.
   */
  static async getTrialBalance(): Promise<TrialBalanceDto> {
    const result = await LedgerInvariantService.verifyTrialBalance();
    return {
      asOf: result.asOf.toISOString(),
      isBalanced: result.isBalanced,
      totalDebitsPaise: result.totalDebitsPaise.toString(),
      totalCreditsPaise: result.totalCreditsPaise.toString(),
      diffPaise: result.diffPaise.toString(),
      accounts: result.accounts.map((a) => ({
        accountId: a.accountId,
        code: a.code,
        accountType: a.accountType,
        debitPaise: a.debitPaise.toString(),
        creditPaise: a.creditPaise.toString(),
        netBalancePaise: a.netBalancePaise.toString(),
      })),
    };
  }
}
