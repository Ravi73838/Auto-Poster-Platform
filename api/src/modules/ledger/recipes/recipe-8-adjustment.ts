import {
  LEDGER_DIRECTIONS,
  LEDGER_REF_TYPES,
  type LedgerDirection,
} from '@ap/shared-constants';
import type { LedgerTransaction, LedgerEntry } from '@prisma/client';
import type { TransactionClient } from '../../../shared/db/index.js';
import { LedgerService } from '../ledger.service.js';
import { AccountDirectory } from '../account-directory.js';

export interface PostManualAdjustmentInput {
  adjustmentId: string;
  targetAccountId: string;
  direction: LedgerDirection;
  amountPaise: bigint;
  reason: string;
  metadata?: unknown;
}

/**
 * Recipe 8: Manual adjustment against SYS_ADJUSTMENT
 * If target direction is DEBIT:
 *   DR targetAccount
 *   CR SYS_ADJUSTMENT
 * If target direction is CREDIT:
 *   DR SYS_ADJUSTMENT
 *   CR targetAccount
 * Key: adjustment:{adjustmentId}
 */
export async function postManualAdjustment(
  input: PostManualAdjustmentInput,
  tx?: TransactionClient,
): Promise<LedgerTransaction & { entries: LedgerEntry[] }> {
  const systemAdjustment = await AccountDirectory.getSystemAdjustmentAccount(tx);

  const entries =
    input.direction === LEDGER_DIRECTIONS.DEBIT
      ? [
          {
            accountId: input.targetAccountId,
            direction: LEDGER_DIRECTIONS.DEBIT,
            amountPaise: input.amountPaise,
          },
          {
            accountId: systemAdjustment.id,
            direction: LEDGER_DIRECTIONS.CREDIT,
            amountPaise: input.amountPaise,
          },
        ]
      : [
          {
            accountId: systemAdjustment.id,
            direction: LEDGER_DIRECTIONS.DEBIT,
            amountPaise: input.amountPaise,
          },
          {
            accountId: input.targetAccountId,
            direction: LEDGER_DIRECTIONS.CREDIT,
            amountPaise: input.amountPaise,
          },
        ];

  return LedgerService.postTransaction(
    {
      refType: LEDGER_REF_TYPES.ADJUSTMENT,
      refId: input.adjustmentId,
      idempotencyKey: `adjustment:${input.adjustmentId}`,
      description: `Manual adjustment ${input.adjustmentId}: ${input.reason}`,
      metadata: input.metadata,
      entries,
    },
    tx,
  );
}

