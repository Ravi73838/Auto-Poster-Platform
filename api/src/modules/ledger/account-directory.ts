import {
  LEDGER_ACCOUNT_TYPES,
} from '@ap/shared-constants';
import type { LedgerAccount } from '@prisma/client';
import type { TransactionClient } from '../../shared/db/index.js';
import { LedgerService } from './ledger.service.js';

export class AccountDirectory {
  static async getGatewayClearingAccount(tx?: TransactionClient): Promise<LedgerAccount> {
    return LedgerService.getOrCreateAccount(
      {
        code: 'SYS_GATEWAY_CLEARING',
        accountType: LEDGER_ACCOUNT_TYPES.GATEWAY_CLEARING,
        currency: 'INR',
      },
      tx,
    );
  }

  static async getGatewayFeesAccount(tx?: TransactionClient): Promise<LedgerAccount> {
    return LedgerService.getOrCreateAccount(
      {
        code: 'SYS_GATEWAY_FEES',
        accountType: LEDGER_ACCOUNT_TYPES.GATEWAY_FEES,
        currency: 'INR',
      },
      tx,
    );
  }

  static async getPlatformRevenueAccount(tx?: TransactionClient): Promise<LedgerAccount> {
    return LedgerService.getOrCreateAccount(
      {
        code: 'SYS_PLATFORM_REVENUE',
        accountType: LEDGER_ACCOUNT_TYPES.PLATFORM_REVENUE,
        currency: 'INR',
      },
      tx,
    );
  }

  static async getGstPayableAccount(tx?: TransactionClient): Promise<LedgerAccount> {
    return LedgerService.getOrCreateAccount(
      {
        code: 'SYS_GST_PAYABLE',
        accountType: LEDGER_ACCOUNT_TYPES.GST_PAYABLE,
        currency: 'INR',
      },
      tx,
    );
  }

  static async getPayoutInTransitAccount(tx?: TransactionClient): Promise<LedgerAccount> {
    return LedgerService.getOrCreateAccount(
      {
        code: 'SYS_PAYOUT_IN_TRANSIT',
        accountType: LEDGER_ACCOUNT_TYPES.PAYOUT_IN_TRANSIT,
        currency: 'INR',
      },
      tx,
    );
  }

  static async getCompanyRefundAccount(tx?: TransactionClient): Promise<LedgerAccount> {
    return LedgerService.getOrCreateAccount(
      {
        code: 'SYS_COMPANY_REFUND',
        accountType: LEDGER_ACCOUNT_TYPES.COMPANY_REFUND,
        currency: 'INR',
      },
      tx,
    );
  }

  static async getSystemAdjustmentAccount(tx?: TransactionClient): Promise<LedgerAccount> {
    return LedgerService.getOrCreateAccount(
      {
        code: 'SYS_ADJUSTMENT',
        accountType: LEDGER_ACCOUNT_TYPES.ADJUSTMENT,
        currency: 'INR',
      },
      tx,
    );
  }

  static async getCampaignEscrowAccount(
    campaignId: string,
    tx?: TransactionClient,
  ): Promise<LedgerAccount> {
    return LedgerService.getOrCreateAccount(
      {
        code: `CAMPAIGN_ESCROW_${campaignId}`,
        accountType: LEDGER_ACCOUNT_TYPES.CAMPAIGN_ESCROW,
        campaignId,
        currency: 'INR',
      },
      tx,
    );
  }

  static async getDriverWalletAccount(
    driverId: string,
    tx?: TransactionClient,
  ): Promise<LedgerAccount> {
    return LedgerService.getOrCreateAccount(
      {
        code: `DRIVER_WALLET_${driverId}`,
        accountType: LEDGER_ACCOUNT_TYPES.DRIVER_WALLET,
        userId: driverId,
        currency: 'INR',
      },
      tx,
    );
  }
}

