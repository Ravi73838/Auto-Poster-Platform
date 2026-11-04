import crypto from 'node:crypto';
import type {
  PayoutProvider,
  CreatePayoutParams,
  CreatePayoutResult,
} from './payout.interface.js';

export class DevPayoutProvider implements PayoutProvider {
  async createPayout(params: CreatePayoutParams): Promise<CreatePayoutResult> {
    const utr = `UTR_DEV_${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    return {
      gatewayReference: utr,
      status: 'PAID',
    };
  }
}

