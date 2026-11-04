import {
  PAYOUT_STATUS,
  PAYOUT_TYPES,
  PAYOUT_METHODS,
  PAYOUT_PROVIDER_NAMES,
  LEDGER_DIRECTIONS,
  SETTING_KEYS,
  type PayoutStatus,
} from '@ap/shared-constants';
import type { Payout, LedgerEntry } from '@prisma/client';
import { prisma, withTransaction, type PaginationParams, type PaginationMeta, getPaginationMeta, paginateQuery } from '../../shared/db/index.js';
import { SettingsService } from '../settings/settings.service.js';
import { AccountDirectory } from '../ledger/account-directory.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { postPayoutReserve, postPayoutComplete } from '../ledger/recipes/index.js';
import { getPayoutProvider } from '../../integrations/payout/index.js';
import {
  NotFoundError,
  ValidationError,
  AppError,
  InsufficientFundsError,
} from '../../shared/errors/index.js';
import type { DriverWalletDto } from '@ap/shared-types';

export class DriverWalletService {
  /**
   * Retrieves driver wallet summary metrics.
   */
  static async getBalance(driverId: string): Promise<DriverWalletDto> {
    return this.getWallet(driverId);
  }

  /**
   * Retrieves driver wallet summary metrics.
   */
  static async getWallet(driverId: string): Promise<DriverWalletDto> {
    const walletAccount = await AccountDirectory.getDriverWalletAccount(driverId);
    const balancePaise = await LedgerService.getBalance(walletAccount.id);

    // Get active in-transit payouts
    const inTransitPayouts = await prisma.payout.findMany({
      where: {
        driverId,
        status: { in: [PAYOUT_STATUS.PENDING, PAYOUT_STATUS.APPROVED, PAYOUT_STATUS.PROCESSING] },
      },
      select: { amountPaise: true },
    });

    const activePayoutInTransitPaise = inTransitPayouts.reduce(
      (sum, p) => sum + p.amountPaise,
      0n,
    );

    // Calculate total earned (all credits) and total withdrawn (all debits)
    const entries = await prisma.ledgerEntry.findMany({
      where: { accountId: walletAccount.id },
      select: { direction: true, amountPaise: true },
    });

    let totalEarnedPaise = 0n;
    let totalWithdrawnPaise = 0n;

    for (const e of entries) {
      if (e.direction === LEDGER_DIRECTIONS.CREDIT) {
        totalEarnedPaise += e.amountPaise;
      } else if (e.direction === LEDGER_DIRECTIONS.DEBIT) {
        totalWithdrawnPaise += e.amountPaise;
      }
    }

    return {
      driverId,
      balancePaise: balancePaise.toString(),
      availablePaise: (balancePaise - activePayoutInTransitPaise).toString(),
      currency: 'INR',
      activePayoutInTransitPaise: activePayoutInTransitPaise.toString(),
      totalEarnedPaise: totalEarnedPaise.toString(),
      totalWithdrawnPaise: totalWithdrawnPaise.toString(),
    };
  }

  /**
   * Retrieves driver wallet statement.
   */
  static async getStatement(
    driverId: string,
    params: PaginationParams = { page: 1, pageSize: 20 },
  ): Promise<{ entries: LedgerEntry[]; meta: PaginationMeta }> {
    const walletAccount = await AccountDirectory.getDriverWalletAccount(driverId);
    return LedgerService.getStatement(walletAccount.id, params);
  }

  /**
   * Requests a wallet withdrawal.
   */
  static async requestWithdrawal(
    driverId: string,
    amountPaise: bigint,
    idempotencyKey?: string,
  ): Promise<Payout> {
    const payoutsEnabled = await SettingsService.get(
      SETTING_KEYS.FINANCE_PAYOUTS_ENABLED,
      true,
    );
    if (!payoutsEnabled) {
      throw new AppError('PAYOUTS_DISABLED', 'Withdrawals are currently disabled', 503);
    }

    const minWithdrawalPaise = BigInt(
      await SettingsService.get(SETTING_KEYS.PAYOUT_MIN_WITHDRAWAL_PAISE, 10000),
    );
    if (amountPaise < minWithdrawalPaise) {
      throw new AppError(
        'WITHDRAWAL_BELOW_MINIMUM',
        `Withdrawal amount must be at least ${minWithdrawalPaise} paise`,
        400,
      );
    }

    const walletAccount = await AccountDirectory.getDriverWalletAccount(driverId);
    const balance = await LedgerService.getBalance(walletAccount.id);

    if (balance < amountPaise) {
      throw new InsufficientFundsError(
        `Insufficient wallet balance (${balance} paise) for withdrawal of ${amountPaise} paise`,
      );
    }

    // Check for existing pending/processing payout
    const activePayout = await prisma.payout.findFirst({
      where: {
        driverId,
        status: { in: [PAYOUT_STATUS.PENDING, PAYOUT_STATUS.APPROVED, PAYOUT_STATUS.PROCESSING] },
      },
    });

    if (activePayout) {
      throw new AppError(
        'ACTIVE_PAYOUT_IN_PROGRESS',
        'A withdrawal request is already in progress',
        400,
      );
    }

    // Check driver profile for payout destination
    const profile = await prisma.driverProfile.findUnique({
      where: { userId: driverId },
    });

    const upiId = profile?.upiIdEncrypted;
    const bankAccount = profile?.bankAccountNumberEncrypted;
    const ifsc = profile?.bankIfsc;

    if (!upiId && !bankAccount) {
      throw new AppError(
        'BANK_DETAILS_MISSING',
        'Please configure your UPI ID or Bank Account in Profile before withdrawing',
        400,
      );
    }

    const method = upiId ? PAYOUT_METHODS.UPI : PAYOUT_METHODS.BANK_ACCOUNT;
    const autoApproveMaxPaise = BigInt(
      await SettingsService.get(SETTING_KEYS.PAYOUT_AUTO_APPROVE_MAX_PAISE, 500000),
    );

    const isAutoApprove = amountPaise <= autoApproveMaxPaise;
    const status: PayoutStatus = isAutoApprove ? PAYOUT_STATUS.APPROVED : PAYOUT_STATUS.PENDING;

    const payout = await withTransaction(async (tx) => {
      const createdPayout = await tx.payout.create({
        data: {
          driverId,
          payoutType: PAYOUT_TYPES.WITHDRAWAL,
          amountPaise,
          method,
          upiIdEncrypted: upiId,
          bankAccountEncrypted: bankAccount ? `${bankAccount} (${ifsc ?? ''})` : null,
          status,
          provider: PAYOUT_PROVIDER_NAMES.DEV,
          idempotencyKey: idempotencyKey ?? `wth:${driverId}:${Date.now()}`,
          requestedById: driverId,
          approvedAt: isAutoApprove ? new Date() : null,
        },
      });

      // Recipe 5A: DR DRIVER_WALLET, CR PAYOUT_IN_TRANSIT
      await postPayoutReserve(
        {
          payoutId: createdPayout.id,
          driverId,
          amountPaise,
          metadata: { isAutoApprove },
        },
        tx,
      );

      return createdPayout;
    });

    // If auto-approved in dev/test environment, execute immediately
    if (isAutoApprove && (process.env.NODE_ENV !== 'production')) {
      const provider = getPayoutProvider(PAYOUT_PROVIDER_NAMES.DEV);
      const res = await provider.createPayout({
        payoutId: payout.id,
        driverId,
        amountPaise,
        method,
        upiId,
        accountNumber: bankAccount,
        ifsc,
      });

      if (res.status === 'PAID') {
        await withTransaction(async (tx) => {
          await postPayoutComplete(
            {
              payoutId: payout.id,
              amountPaise,
            },
            tx,
          );

          await tx.payout.update({
            where: { id: payout.id },
            data: {
              status: PAYOUT_STATUS.PAID,
              gatewayReference: res.gatewayReference,
              processedAt: new Date(),
            },
          });
        });
      }
    }

    return prisma.payout.findUnique({ where: { id: payout.id } }) as Promise<Payout>;
  }
}
