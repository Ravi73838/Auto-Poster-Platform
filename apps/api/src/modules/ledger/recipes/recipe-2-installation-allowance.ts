import {
  LEDGER_DIRECTIONS,
  LEDGER_REF_TYPES,
} from '@ap/shared-constants';
import type { LedgerTransaction, LedgerEntry } from '@prisma/client';
import type { TransactionClient } from '../../../shared/db/index.js';
import { LedgerService } from '../ledger.service.js';
import { AccountDirectory } from '../account-directory.js';

export interface PostInstallationAllowanceInput {
  assignmentId: string;
  campaignId: string;
  driverId: string;
  amountPaise: bigint;
  metadata?: unknown;
}

/**
 * Recipe 2: Installation approved (printing allowance credited to driver)
 * DR CAMPAIGN_ESCROW (campaign)
 * CR DRIVER_WALLET (driver)
 * Key: allowance:{assignmentId}
 */
export async function postInstallationAllowance(
  input: PostInstallationAllowanceInput,
  tx?: TransactionClient,
): Promise<LedgerTransaction & { entries: LedgerEntry[] }> {
  const campaignEscrow = await AccountDirectory.getCampaignEscrowAccount(input.campaignId, tx);
  const driverWallet = await AccountDirectory.getDriverWalletAccount(input.driverId, tx);

  return LedgerService.postTransaction(
    {
      refType: LEDGER_REF_TYPES.PRINTING_ALLOWANCE,
      refId: input.assignmentId,
      idempotencyKey: `allowance:${input.assignmentId}`,
      description: `Printing allowance for assignment ${input.assignmentId}`,
      metadata: input.metadata,
      entries: [
        {
          accountId: campaignEscrow.id,
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

