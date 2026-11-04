import {
  LEDGER_DIRECTIONS,
  LEDGER_REF_TYPES,
} from '@ap/shared-constants';
import type { LedgerTransaction, LedgerEntry } from '@prisma/client';
import type { TransactionClient } from '../../../shared/db/index.js';
import { LedgerService } from '../ledger.service.js';
import { AccountDirectory } from '../account-directory.js';

export interface PostCampaignCloseoutInput {
  campaignId: string;
  amountPaise: bigint;
  metadata?: unknown;
}

/**
 * Recipe 6: Campaign closeout sweep (unspent escrow swept to company refund liability)
 * DR CAMPAIGN_ESCROW
 * CR COMPANY_REFUND
 * Key: closeout:{campaignId}
 */
export async function postCampaignCloseout(
  input: PostCampaignCloseoutInput,
  tx?: TransactionClient,
): Promise<LedgerTransaction & { entries: LedgerEntry[] }> {
  const campaignEscrow = await AccountDirectory.getCampaignEscrowAccount(input.campaignId, tx);
  const companyRefund = await AccountDirectory.getCompanyRefundAccount(tx);

  return LedgerService.postTransaction(
    {
      refType: LEDGER_REF_TYPES.CAMPAIGN_CLOSEOUT,
      refId: input.campaignId,
      idempotencyKey: `closeout:${input.campaignId}`,
      description: `Campaign closeout sweep for campaign ${input.campaignId}`,
      metadata: input.metadata,
      entries: [
        {
          accountId: campaignEscrow.id,
          direction: LEDGER_DIRECTIONS.DEBIT,
          amountPaise: input.amountPaise,
        },
        {
          accountId: companyRefund.id,
          direction: LEDGER_DIRECTIONS.CREDIT,
          amountPaise: input.amountPaise,
        },
      ],
    },
    tx,
  );
}

