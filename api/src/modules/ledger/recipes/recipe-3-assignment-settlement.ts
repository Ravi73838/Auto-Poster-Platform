import {
  LEDGER_DIRECTIONS,
  LEDGER_REF_TYPES,
} from '@ap/shared-constants';
import type { LedgerTransaction, LedgerEntry } from '@prisma/client';
import type { TransactionClient } from '../../../shared/db/index.js';
import { LedgerService, type PostEntryInput } from '../ledger.service.js';
import { AccountDirectory } from '../account-directory.js';
import { ValidationError } from '../../../shared/errors/index.js';

export interface PostAssignmentSettlementInput {
  assignmentId: string;
  campaignId: string;
  driverId: string;
  rentPayablePaise: bigint;
  companyRefundPaise: bigint;
  commissionPaise: bigint;
  gstPaise: bigint;
  metadata?: unknown;
}

/**
 * Recipe 3: Assignment settlement
 * DR CAMPAIGN_ESCROW (R + C + G)
 * CR DRIVER_WALLET (rentPayable)
 * CR COMPANY_REFUND (companyRefund)
 * CR PLATFORM_REVENUE (commission)
 * CR GST_PAYABLE (GST)
 * Key: settle:{assignmentId}
 */
export async function postAssignmentSettlement(
  input: PostAssignmentSettlementInput,
  tx?: TransactionClient,
): Promise<LedgerTransaction & { entries: LedgerEntry[] }> {
  const totalDebit =
    input.rentPayablePaise +
    input.companyRefundPaise +
    input.commissionPaise +
    input.gstPaise;

  if (totalDebit <= 0n) {
    throw new ValidationError('Settlement total debit must be greater than 0 paise');
  }

  const campaignEscrow = await AccountDirectory.getCampaignEscrowAccount(input.campaignId, tx);
  const driverWallet = await AccountDirectory.getDriverWalletAccount(input.driverId, tx);
  const companyRefund = await AccountDirectory.getCompanyRefundAccount(tx);
  const platformRevenue = await AccountDirectory.getPlatformRevenueAccount(tx);
  const gstPayable = await AccountDirectory.getGstPayableAccount(tx);

  const entries: PostEntryInput[] = [
    {
      accountId: campaignEscrow.id,
      direction: LEDGER_DIRECTIONS.DEBIT,
      amountPaise: totalDebit,
    },
  ];

  if (input.rentPayablePaise > 0n) {
    entries.push({
      accountId: driverWallet.id,
      direction: LEDGER_DIRECTIONS.CREDIT,
      amountPaise: input.rentPayablePaise,
    });
  }

  if (input.companyRefundPaise > 0n) {
    entries.push({
      accountId: companyRefund.id,
      direction: LEDGER_DIRECTIONS.CREDIT,
      amountPaise: input.companyRefundPaise,
    });
  }

  if (input.commissionPaise > 0n) {
    entries.push({
      accountId: platformRevenue.id,
      direction: LEDGER_DIRECTIONS.CREDIT,
      amountPaise: input.commissionPaise,
    });
  }

  if (input.gstPaise > 0n) {
    entries.push({
      accountId: gstPayable.id,
      direction: LEDGER_DIRECTIONS.CREDIT,
      amountPaise: input.gstPaise,
    });
  }

  return LedgerService.postTransaction(
    {
      refType: LEDGER_REF_TYPES.SETTLEMENT,
      refId: input.assignmentId,
      idempotencyKey: `settle:${input.assignmentId}`,
      description: `Settlement for assignment ${input.assignmentId}`,
      metadata: input.metadata,
      entries,
    },
    tx,
  );
}

