import {
  LEDGER_DIRECTIONS,
  LEDGER_REF_TYPES,
} from '@ap/shared-constants';
import type { LedgerTransaction, LedgerEntry } from '@prisma/client';
import type { TransactionClient } from '../../../shared/db/index.js';
import { LedgerService } from '../ledger.service.js';
import { AccountDirectory } from '../account-directory.js';

export interface PostRefundReserveInput {
  refundId: string;
  campaignId: string;
  amountPaise: bigint;
  metadata?: unknown;
}

export interface PostRefundPayoutInput {
  refundId: string;
  amountPaise: bigint;
  metadata?: unknown;
}

/**
 * Recipe 4A: Refund approved from escrow to company refund balance
 * DR CAMPAIGN_ESCROW
 * CR COMPANY_REFUND
 * Key: refund-reserve:{refundId}
 */
export async function postRefundReserve(
  input: PostRefundReserveInput,
  tx?: TransactionClient,
): Promise<LedgerTransaction & { entries: LedgerEntry[] }> {
  const campaignEscrow = await AccountDirectory.getCampaignEscrowAccount(input.campaignId, tx);
  const companyRefund = await AccountDirectory.getCompanyRefundAccount(tx);

  return LedgerService.postTransaction(
    {
      refType: LEDGER_REF_TYPES.REFUND,
      refId: input.refundId,
      idempotencyKey: `refund-reserve:${input.refundId}`,
      description: `Refund reserved for refund ${input.refundId}`,
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

/**
 * Recipe 4B: Refund executed via payment gateway back to customer
 * DR COMPANY_REFUND
 * CR GATEWAY_CLEARING
 * Key: refund-payout:{refundId}
 */
export async function postRefundPayout(
  input: PostRefundPayoutInput,
  tx?: TransactionClient,
): Promise<LedgerTransaction & { entries: LedgerEntry[] }> {
  const companyRefund = await AccountDirectory.getCompanyRefundAccount(tx);
  const gatewayClearing = await AccountDirectory.getGatewayClearingAccount(tx);

  return LedgerService.postTransaction(
    {
      refType: LEDGER_REF_TYPES.REFUND,
      refId: input.refundId,
      idempotencyKey: `refund-payout:${input.refundId}`,
      description: `Refund paid via gateway for refund ${input.refundId}`,
      metadata: input.metadata,
      entries: [
        {
          accountId: companyRefund.id,
          direction: LEDGER_DIRECTIONS.DEBIT,
          amountPaise: input.amountPaise,
        },
        {
          accountId: gatewayClearing.id,
          direction: LEDGER_DIRECTIONS.CREDIT,
          amountPaise: input.amountPaise,
        },
      ],
    },
    tx,
  );
}

