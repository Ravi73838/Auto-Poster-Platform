import type { PayoutMethod } from '@ap/shared-constants';

export interface CreatePayoutParams {
  payoutId: string;
  driverId: string;
  amountPaise: bigint;
  method: PayoutMethod;
  upiId?: string | null;
  accountNumber?: string | null;
  ifsc?: string | null;
  accountHolderName?: string | null;
}

export interface CreatePayoutResult {
  gatewayReference?: string;
  status: 'PENDING' | 'PAID' | 'FAILED';
  failureReason?: string;
}

export interface PayoutCsvRow {
  payoutId: string;
  driverId: string;
  amountRupees: string;
  method: string;
  payeeAddress: string;
  status?: string;
  utr?: string;
  failureReason?: string;
}

export interface PayoutProvider {
  createPayout(params: CreatePayoutParams): Promise<CreatePayoutResult>;
}

