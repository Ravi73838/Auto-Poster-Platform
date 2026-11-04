import {
  LEDGER_DIRECTIONS,
  LEDGER_ACCOUNT_TYPES,
  type LedgerDirection,
  type LedgerRefType,
  type LedgerAccountType,
} from '@ap/shared-constants';
import {
  type LedgerAccount,
  type LedgerTransaction,
  type LedgerEntry,
} from '@prisma/client';
import {
  prisma,
  withTransaction,
  type TransactionClient,
  getPaginationMeta,
  paginateQuery,
  type PaginationParams,
  type PaginationMeta,
} from '../../shared/db/index.js';
import {
  LedgerUnbalancedError,
  InsufficientFundsError,
  NotFoundError,
  ValidationError,
  DuplicateRequestError,
} from '../../shared/errors/index.js';

export interface PostEntryInput {
  accountId: string;
  direction: LedgerDirection;
  amountPaise: bigint;
}

export interface PostTransactionInput {
  refType: LedgerRefType;
  refId: string;
  description: string;
  idempotencyKey?: string;
  metadata?: unknown;
  entries: PostEntryInput[];
}

export interface GetOrCreateAccountInput {
  code: string;
  accountType: LedgerAccountType;
  userId?: string | null;
  campaignId?: string | null;
  currency?: string;
}

export class LedgerService {
  /**
   * Accounts where CREDIT increases the balance and DEBIT decreases it (liabilities / platform revenue).
   * For these, balance cannot drop below 0 if they don't permit overdraft.
   */
  private static readonly CREDIT_NORMAL_TYPES: readonly LedgerAccountType[] = [
    LEDGER_ACCOUNT_TYPES.CAMPAIGN_ESCROW,
    LEDGER_ACCOUNT_TYPES.DRIVER_WALLET,
    LEDGER_ACCOUNT_TYPES.PAYOUT_IN_TRANSIT,
    LEDGER_ACCOUNT_TYPES.COMPANY_REFUND,
    LEDGER_ACCOUNT_TYPES.PLATFORM_REVENUE,
    LEDGER_ACCOUNT_TYPES.GST_PAYABLE,
  ];

  /**
   * Accounts that strictly forbid negative balances (overdraft).
   */
  private static readonly NON_OVERDRAFT_TYPES: readonly LedgerAccountType[] = [
    LEDGER_ACCOUNT_TYPES.CAMPAIGN_ESCROW,
    LEDGER_ACCOUNT_TYPES.DRIVER_WALLET,
    LEDGER_ACCOUNT_TYPES.PAYOUT_IN_TRANSIT,
    LEDGER_ACCOUNT_TYPES.COMPANY_REFUND,
  ];

  /**
   * Finds or creates a ledger account by its unique code.
   */
  static async getOrCreateAccount(
    input: GetOrCreateAccountInput,
    tx?: TransactionClient,
  ): Promise<LedgerAccount> {
    const client = tx ?? prisma;

    const existing = await client.ledgerAccount.findUnique({
      where: { code: input.code },
    });

    if (existing) {
      return existing;
    }

    return client.ledgerAccount.create({
      data: {
        code: input.code,
        accountType: input.accountType,
        userId: input.userId ?? null,
        campaignId: input.campaignId ?? null,
        currency: input.currency ?? 'INR',
      },
    });
  }

  /**
   * Gets the current balance for an account (paise).
   * Reads the latest snapshot balanceAfterPaise from ledger_entries.
   */
  static async getBalance(
    accountId: string,
    tx?: TransactionClient,
  ): Promise<bigint> {
    const client = tx ?? prisma;

    const latestEntry = await client.ledgerEntry.findFirst({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      select: { balanceAfterPaise: true },
    });

    return latestEntry?.balanceAfterPaise ?? 0n;
  }

  /**
   * Posts an atomic, balanced, double-entry transaction.
   * Enforces debits == credits and overdraft protection.
   */
  static async postTransaction(
    input: PostTransactionInput,
    externalTx?: TransactionClient | { $transaction: <T>(fn: (tx: TransactionClient) => Promise<T>) => Promise<T> },
  ): Promise<LedgerTransaction & { entries: LedgerEntry[] }> {
    if (input.entries.length < 2) {
      throw new ValidationError(
        'A ledger transaction must contain at least two entries',
      );
    }

    // 1. Verify debits == credits
    let totalDebit = 0n;
    let totalCredit = 0n;

    for (const entry of input.entries) {
      const amount = BigInt(entry.amountPaise ?? 0);
      if (amount <= 0n) {
        throw new ValidationError(
          `Entry amount must be greater than 0 paise, received ${entry.amountPaise}`,
        );
      }
      if (entry.direction === LEDGER_DIRECTIONS.DEBIT) {
        totalDebit += amount;
      } else if (entry.direction === LEDGER_DIRECTIONS.CREDIT) {
        totalCredit += amount;
      } else {
        throw new ValidationError(`Invalid ledger direction: ${entry.direction}`);
      }
    }

    if (totalDebit !== totalCredit) {
      throw new LedgerUnbalancedError(
        `Ledger transaction is unbalanced: total debits (${totalDebit}) != total credits (${totalCredit})`,
        { totalDebit, totalCredit },
      );
    }

    const executeInTx = async (
      tx: TransactionClient,
    ): Promise<LedgerTransaction & { entries: LedgerEntry[] }> => {
      // 1.5 Check idempotency key if provided
      if (input.idempotencyKey) {
        const existing = await tx.ledgerTransaction.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: { entries: true },
        });
        if (existing) {
          if (existing.refType === input.refType && existing.refId === input.refId) {
            return existing;
          }
          throw new DuplicateRequestError(
            `Idempotency key "${input.idempotencyKey}" already used with different parameters`,
          );
        }
      }

      // 2. Create the LedgerTransaction header
      const transaction = await tx.ledgerTransaction.create({
        data: {
          refType: input.refType,
          refId: input.refId,
          description: input.description,
          idempotencyKey: input.idempotencyKey,
          metadata: (input.metadata as object) ?? undefined,
        },
      });

      const createdEntries: LedgerEntry[] = [];

      // 3. Process entries sequentially, calculating balanceAfterPaise
      for (const entry of input.entries) {
        const account = await tx.ledgerAccount.findUnique({
          where: { id: entry.accountId },
        });

        if (!account) {
          throw new NotFoundError(
            `Ledger account with id "${entry.accountId}" not found`,
          );
        }

        const currentBalance = await this.getBalance(entry.accountId, tx);

        // Determine if account is Credit-normal
        const isCreditNormal = this.CREDIT_NORMAL_TYPES.includes(
          account.accountType,
        );

        let delta: bigint;
        if (isCreditNormal) {
          delta =
            entry.direction === LEDGER_DIRECTIONS.CREDIT
              ? entry.amountPaise
              : -entry.amountPaise;
        } else {
          delta =
            entry.direction === LEDGER_DIRECTIONS.DEBIT
              ? entry.amountPaise
              : -entry.amountPaise;
        }

        const newBalance = currentBalance + delta;

        // Overdraft check
        if (
          this.NON_OVERDRAFT_TYPES.includes(account.accountType) &&
          newBalance < 0n
        ) {
          throw new InsufficientFundsError(
            `Account ${account.code} has insufficient balance (${currentBalance} paise). Attempted reduction of ${entry.amountPaise} paise would result in ${newBalance} paise.`,
            { accountCode: account.code, currentBalance, required: entry.amountPaise },
          );
        }

        const createdEntry = await tx.ledgerEntry.create({
          data: {
            transactionId: transaction.id,
            accountId: entry.accountId,
            direction: entry.direction,
            amountPaise: entry.amountPaise,
            balanceAfterPaise: newBalance,
          },
        });

        createdEntries.push(createdEntry);
      }

      return {
        ...transaction,
        entries: createdEntries,
      };
    };

    if (externalTx && '$transaction' in externalTx) {
      return (
        externalTx as {
          $transaction: <T>(fn: (tx: TransactionClient) => Promise<T>) => Promise<T>;
        }
      ).$transaction(executeInTx);
    }

    if (externalTx) {
      return executeInTx(externalTx as TransactionClient);
    }

    return withTransaction(executeInTx);
  }

  /**
   * Retrieves an account statement with pagination.
   */
  static async getStatement(
    accountId: string,
    params: PaginationParams = { page: 1, pageSize: 20 },
  ): Promise<{ entries: LedgerEntry[]; meta: PaginationMeta }> {
    const total = await prisma.ledgerEntry.count({
      where: { accountId },
    });

    const meta = getPaginationMeta(total, params);
    const { skip, take } = paginateQuery(params);

    const entries = await prisma.ledgerEntry.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: {
        transaction: true,
      },
    });

    return { entries, meta };
  }
}
