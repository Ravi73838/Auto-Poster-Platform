import type {
  PayoutProvider,
  CreatePayoutParams,
  CreatePayoutResult,
  PayoutCsvRow,
} from './payout.interface.js';
import { toRupees } from '../../shared/money/index.js';
import { ValidationError } from '../../shared/errors/index.js';

export class ManualPayoutProvider implements PayoutProvider {
  async createPayout(params: CreatePayoutParams): Promise<CreatePayoutResult> {
    // For manual CSV, payout stays PENDING/PROCESSING until CSV batch is exported and processed
    return {
      status: 'PENDING',
    };
  }

  /**
   * Generates a standard CSV string for bank batch transfer.
   */
  static generatePayoutCsv(
    payouts: Array<{
      id: string;
      driverId: string;
      amountPaise: bigint;
      method: string;
      upiIdEncrypted?: string | null;
      bankAccountEncrypted?: string | null;
    }>,
  ): string {
    const header = 'payout_id,driver_id,amount_rupees,method,payee_address\n';
    const lines = payouts.map((p) => {
      const rupees = toRupees(p.amountPaise);
      const payee = p.method === 'UPI' ? p.upiIdEncrypted ?? '' : p.bankAccountEncrypted ?? '';
      return `"${p.id}","${p.driverId}","${rupees}","${p.method}","${payee}"`;
    });
    return header + lines.join('\n');
  }

  /**
   * Parses and validates a bank result CSV.
   */
  static parseResultCsv(csvContent: string): PayoutCsvRow[] {
    const lines = csvContent
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      throw new ValidationError('CSV file is empty or missing headers');
    }

    const header = lines[0]!.toLowerCase();
    if (!header.includes('payout_id') || !header.includes('status')) {
      throw new ValidationError('CSV must contain "payout_id" and "status" columns');
    }

    const headers = header.split(',').map((h) => h.replace(/["']/g, '').trim());
    const payoutIdIdx = headers.indexOf('payout_id');
    const statusIdx = headers.indexOf('status');
    const utrIdx = headers.indexOf('utr');
    const failureReasonIdx = headers.indexOf('failure_reason');

    const results: PayoutCsvRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i]!.split(',').map((p) => p.replace(/["']/g, '').trim());
      const payoutId = parts[payoutIdIdx];
      const status = parts[statusIdx]?.toUpperCase();

      if (!payoutId || !status) {
        continue;
      }

      results.push({
        payoutId,
        driverId: '',
        amountRupees: '',
        method: '',
        payeeAddress: '',
        status,
        utr: utrIdx >= 0 ? parts[utrIdx] : undefined,
        failureReason: failureReasonIdx >= 0 ? parts[failureReasonIdx] : undefined,
      });
    }

    return results;
  }
}

