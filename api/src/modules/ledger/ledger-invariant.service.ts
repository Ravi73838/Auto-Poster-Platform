import {
  LEDGER_DIRECTIONS,
  LEDGER_ACCOUNT_TYPES,
  type LedgerAccountType,
} from '@ap/shared-constants';
import { prisma, type TransactionClient } from '../../shared/db/index.js';
import { LedgerService } from './ledger.service.js';

export interface AccountBalanceSummary {
  accountId: string;
  code: string;
  accountType: LedgerAccountType;
  debitPaise: bigint;
  creditPaise: bigint;
  netBalancePaise: bigint;
}

export interface TrialBalanceResult {
  asOf: Date;
  isBalanced: boolean;
  totalDebitsPaise: bigint;
  totalCreditsPaise: bigint;
  diffPaise: bigint;
  accounts: AccountBalanceSummary[];
}

export class LedgerInvariantService {
  /**
   * Verifies system-wide double-entry equilibrium: Sum(Debits) == Sum(Credits).
   */
  static async verifyTrialBalance(tx?: TransactionClient): Promise<TrialBalanceResult> {
    const client = tx ?? prisma;
    const asOf = new Date();

    const accounts = await client.ledgerAccount.findMany({
      include: {
        entries: {
          select: {
            direction: true,
            amountPaise: true,
            balanceAfterPaise: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    let totalDebitsPaise = 0n;
    let totalCreditsPaise = 0n;
    const summaries: AccountBalanceSummary[] = [];

    for (const acc of accounts) {
      let accDebit = 0n;
      let accCredit = 0n;

      for (const entry of acc.entries) {
        if (entry.direction === LEDGER_DIRECTIONS.DEBIT) {
          accDebit += entry.amountPaise;
          totalDebitsPaise += entry.amountPaise;
        } else if (entry.direction === LEDGER_DIRECTIONS.CREDIT) {
          accCredit += entry.amountPaise;
          totalCreditsPaise += entry.amountPaise;
        }
      }

      const latestEntry = acc.entries[acc.entries.length - 1];
      const netBalance = latestEntry?.balanceAfterPaise ?? 0n;

      summaries.push({
        accountId: acc.id,
        code: acc.code,
        accountType: acc.accountType,
        debitPaise: accDebit,
        creditPaise: accCredit,
        netBalancePaise: netBalance,
      });
    }

    const diffPaise = totalDebitsPaise >= totalCreditsPaise
      ? totalDebitsPaise - totalCreditsPaise
      : totalCreditsPaise - totalDebitsPaise;

    return {
      asOf,
      isBalanced: totalDebitsPaise === totalCreditsPaise,
      totalDebitsPaise,
      totalCreditsPaise,
      diffPaise,
      accounts: summaries,
    };
  }

  /**
   * Validates account history integrity from genesis.
   */
  static async verifyAccountInvariants(
    accountId: string,
    tx?: TransactionClient,
  ): Promise<{ valid: boolean; calculatedBalance: bigint; snapshotBalance: bigint; error?: string }> {
    const client = tx ?? prisma;

    const account = await client.ledgerAccount.findUnique({
      where: { id: accountId },
      include: {
        entries: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!account) {
      return { valid: false, calculatedBalance: 0n, snapshotBalance: 0n, error: 'Account not found' };
    }

    const isCreditNormal = (
      [
        LEDGER_ACCOUNT_TYPES.CAMPAIGN_ESCROW,
        LEDGER_ACCOUNT_TYPES.DRIVER_WALLET,
        LEDGER_ACCOUNT_TYPES.PAYOUT_IN_TRANSIT,
        LEDGER_ACCOUNT_TYPES.COMPANY_REFUND,
        LEDGER_ACCOUNT_TYPES.PLATFORM_REVENUE,
        LEDGER_ACCOUNT_TYPES.GST_PAYABLE,
      ] as LedgerAccountType[]
    ).includes(account.accountType);

    const isNonOverdraft = (
      [
        LEDGER_ACCOUNT_TYPES.CAMPAIGN_ESCROW,
        LEDGER_ACCOUNT_TYPES.DRIVER_WALLET,
        LEDGER_ACCOUNT_TYPES.PAYOUT_IN_TRANSIT,
        LEDGER_ACCOUNT_TYPES.COMPANY_REFUND,
      ] as LedgerAccountType[]
    ).includes(account.accountType);

    let runningBalance = 0n;

    for (const entry of account.entries) {
      const delta = isCreditNormal
        ? entry.direction === LEDGER_DIRECTIONS.CREDIT
          ? entry.amountPaise
          : -entry.amountPaise
        : entry.direction === LEDGER_DIRECTIONS.DEBIT
        ? entry.amountPaise
        : -entry.amountPaise;

      runningBalance += delta;

      if (runningBalance !== entry.balanceAfterPaise) {
        return {
          valid: false,
          calculatedBalance: runningBalance,
          snapshotBalance: entry.balanceAfterPaise,
          error: `Snapshot mismatch at entry ${entry.id}`,
        };
      }

      if (isNonOverdraft && runningBalance < 0n) {
        return {
          valid: false,
          calculatedBalance: runningBalance,
          snapshotBalance: entry.balanceAfterPaise,
          error: `Non-overdraft invariant violated at entry ${entry.id}`,
        };
      }
    }

    const latestBalance = await LedgerService.getBalance(accountId, tx);

    return {
      valid: true,
      calculatedBalance: runningBalance,
      snapshotBalance: latestBalance,
    };
  }
}
