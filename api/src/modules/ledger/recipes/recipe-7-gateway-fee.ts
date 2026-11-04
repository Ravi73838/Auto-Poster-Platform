import {
  LEDGER_DIRECTIONS,
  LEDGER_REF_TYPES,
} from '@ap/shared-constants';
import type { LedgerTransaction, LedgerEntry } from '@prisma/client';
import type { TransactionClient } from '../../../shared/db/index.js';
import { LedgerService } from '../ledger.service.js';
import { AccountDirectory } from '../account-directory.js';

export interface PostGatewayFeeInput {
  paymentId: string;
  feePaise: bigint;
  metadata?: unknown;
}

/**
 * Recipe 7: Payment gateway processing fee
 * DR GATEWAY_FEES
 * CR GATEWAY_CLEARING
 * Key: gateway-fee:{paymentId}
 */
export async function postGatewayFee(
  input: PostGatewayFeeInput,
  tx?: TransactionClient,
): Promise<LedgerTransaction & { entries: LedgerEntry[] }> {
  const gatewayFees = await AccountDirectory.getGatewayFeesAccount(tx);
  const gatewayClearing = await AccountDirectory.getGatewayClearingAccount(tx);

  return LedgerService.postTransaction(
    {
      refType: LEDGER_REF_TYPES.COMMISSION,
      refId: input.paymentId,
      idempotencyKey: `gateway-fee:${input.paymentId}`,
      description: `Payment gateway fee for payment ${input.paymentId}`,
      metadata: input.metadata,
      entries: [
        {
          accountId: gatewayFees.id,
          direction: LEDGER_DIRECTIONS.DEBIT,
          amountPaise: input.feePaise,
        },
        {
          accountId: gatewayClearing.id,
          direction: LEDGER_DIRECTIONS.CREDIT,
          amountPaise: input.feePaise,
        },
      ],
    },
    tx,
  );
}

