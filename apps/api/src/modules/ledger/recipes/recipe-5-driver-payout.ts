import {
  LEDGER_DIRECTIONS,
  LEDGER_REF_TYPES,
} from '@ap/shared-constants';
import type { LedgerTransaction, LedgerEntry } from '@prisma/client';
import type { TransactionClient } from '../../../shared/db/index.js';
import { LedgerService } from '../ledger.service.js';
import { AccountDirectory } from '../account-directory.js';

export interface PostPayoutReserveInput {
  payoutId: string;
  driverId: string;
  amountPaise: bigint;
  metadata?: unknown;
}

export interface PostPayoutCompleteInput {
  payoutId: string;
  amountPaise: bigint;
  metadata?: unknown;
}

export interface PostPayoutReversalInput {
  payoutId: string;
  driverId: string;
  amountPaise: bigint;
  reason?: string;
  metadata?: unknown;
}

/**
 * Recipe 5A: Driver payout reserved (funds moved to in-transit)
 * DR DRIVER_WALLET
 * CR PAYOUT_IN_TRANSIT
 * Key: payout-reserve:{payoutId}
 */
export async function postPayoutReserve(
  input: PostPayoutReserveInput,
  tx?: TransactionClient,
): Promise<LedgerTransaction & { entries: LedgerEntry[] }> {
  const driverWallet = await AccountDirectory.getDriverWalletAccount(input.driverId, tx);
  const payoutInTransit = await AccountDirectory.getPayoutInTransitAccount(tx);

  return LedgerService.postTransaction(
    {
      refType: LEDGER_REF_TYPES.PAYOUT_RESERVE,
      refId: input.payoutId,
      idempotencyKey: `payout-reserve:${input.payoutId}`,
      description: `Payout reserved for driver ${input.driverId}`,
      metadata: input.metadata,
      entries: [
        {
          accountId: driverWallet.id,
          direction: LEDGER_DIRECTIONS.DEBIT,
          amountPaise: input.amountPaise,
        },
        {
          accountId: payoutInTransit.id,
          direction: LEDGER_DIRECTIONS.CREDIT,
          amountPaise: input.amountPaise,
        },
      ],
    },
    tx,
  );
}

/**
 * Recipe 5B: Driver payout paid (funds cleared by gateway)
 * DR PAYOUT_IN_TRANSIT
 * CR GATEWAY_CLEARING
 * Key: payout-complete:{payoutId}
 */
export async function postPayoutComplete(
  input: PostPayoutCompleteInput,
  tx?: TransactionClient,
): Promise<LedgerTransaction & { entries: LedgerEntry[] }> {
  const payoutInTransit = await AccountDirectory.getPayoutInTransitAccount(tx);
  const gatewayClearing = await AccountDirectory.getGatewayClearingAccount(tx);

  return LedgerService.postTransaction(
    {
      refType: LEDGER_REF_TYPES.PAYOUT_COMPLETE,
      refId: input.payoutId,
      idempotencyKey: `payout-complete:${input.payoutId}`,
      description: `Payout completed for payout ${input.payoutId}`,
      metadata: input.metadata,
      entries: [
        {
          accountId: payoutInTransit.id,
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

/**
 * Recipe 5C: Driver payout failed / reversed (funds returned to wallet)
 * DR PAYOUT_IN_TRANSIT
 * CR DRIVER_WALLET
 * Key: payout-reverse:{payoutId}
 */
export async function postPayoutReversal(
  input: PostPayoutReversalInput,
  tx?: TransactionClient,
): Promise<LedgerTransaction & { entries: LedgerEntry[] }> {
  const payoutInTransit = await AccountDirectory.getPayoutInTransitAccount(tx);
  const driverWallet = await AccountDirectory.getDriverWalletAccount(input.driverId, tx);

  return LedgerService.postTransaction(
    {
      refType: LEDGER_REF_TYPES.PAYOUT_REVERSAL,
      refId: input.payoutId,
      idempotencyKey: `payout-reverse:${input.payoutId}`,
      description: `Payout reversed for payout ${input.payoutId}: ${input.reason ?? 'failed'}`,
      metadata: input.metadata,
      entries: [
        {
          accountId: payoutInTransit.id,
          direction: LEDGER_DIRECTIONS.DEBIT,
          amountPaise: input.amountPaise,
        },
        {
          accountId: driverWallet.id,
          direction: LEDGER_DIRECTIONS.CREDIT,
          amountPaise: input.amountPaise,
        },
      ],
    },
    tx,
  );
}

