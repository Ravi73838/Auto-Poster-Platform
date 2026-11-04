import {
  LEDGER_DIRECTIONS,
  LEDGER_REF_TYPES,
} from '@ap/shared-constants';
import type { LedgerTransaction, LedgerEntry } from '@prisma/client';
import type { TransactionClient } from '../../../shared/db/index.js';
import { LedgerService } from '../ledger.service.js';
import { AccountDirectory } from '../account-directory.js';

export interface PostPaymentCapturedInput {
  paymentId: string;
  campaignId: string;
  amountPaise: bigint;
  metadata?: unknown;
}

/**
 * Recipe 1: Company payment captured
 * DR GATEWAY_CLEARING
 * CR CAMPAIGN_ESCROW (campaign)
 * Key: pay:{paymentId}
 */
export async function postPaymentCaptured(
  input: PostPaymentCapturedInput,
  tx?: TransactionClient,
): Promise<LedgerTransaction & { entries: LedgerEntry[] }> {
  const gatewayClearing = await AccountDirectory.getGatewayClearingAccount(tx);
  const campaignEscrow = await AccountDirectory.getCampaignEscrowAccount(input.campaignId, tx);

  return LedgerService.postTransaction(
    {
      refType: LEDGER_REF_TYPES.CAMPAIGN_PAYMENT,
      refId: input.paymentId,
      idempotencyKey: `pay:${input.paymentId}`,
      description: `Company payment captured for campaign ${input.campaignId}`,
      metadata: input.metadata,
      entries: [
        {
          accountId: gatewayClearing.id,
          direction: LEDGER_DIRECTIONS.DEBIT,
          amountPaise: input.amountPaise,
        },
        {
          accountId: campaignEscrow.id,
          direction: LEDGER_DIRECTIONS.CREDIT,
          amountPaise: input.amountPaise,
        },
      ],
    },
    tx,
  );
}

