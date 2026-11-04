import type { PayoutProvider } from './payout.interface.js';
import { DevPayoutProvider } from './dev-payout.provider.js';
import { ManualPayoutProvider } from './manual-payout.provider.js';
import { PAYOUT_PROVIDER_NAMES, type PayoutProviderName } from '@ap/shared-constants';
import { ValidationError } from '../../shared/errors/index.js';

export * from './payout.interface.js';
export * from './dev-payout.provider.js';
export * from './manual-payout.provider.js';

let defaultDevPayoutProvider: DevPayoutProvider | null = null;
let defaultManualPayoutProvider: ManualPayoutProvider | null = null;

export function getPayoutProvider(providerName: PayoutProviderName = PAYOUT_PROVIDER_NAMES.DEV): PayoutProvider {
  if (providerName === PAYOUT_PROVIDER_NAMES.DEV) {
    if (process.env.NODE_ENV === 'production') {
      throw new ValidationError('Dev payout provider is strictly disallowed in production');
    }
    if (!defaultDevPayoutProvider) {
      defaultDevPayoutProvider = new DevPayoutProvider();
    }
    return defaultDevPayoutProvider;
  }

  if (!defaultManualPayoutProvider) {
    defaultManualPayoutProvider = new ManualPayoutProvider();
  }
  return defaultManualPayoutProvider;
}

