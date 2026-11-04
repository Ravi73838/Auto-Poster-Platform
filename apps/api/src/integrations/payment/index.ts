import type { PaymentProvider } from './payment.interface.js';
import { DevPaymentProvider } from './dev-payment.provider.js';
import { RazorpayProvider } from './razorpay.provider.js';
import { ValidationError } from '../../shared/errors/index.js';

export * from './payment.interface.js';
export * from './dev-payment.provider.js';
export * from './razorpay.provider.js';

let defaultDevProvider: DevPaymentProvider | null = null;
let defaultRazorpayProvider: RazorpayProvider | null = null;

export function getPaymentProvider(gateway = 'DEV'): PaymentProvider {
  const isDev =
    gateway.toUpperCase() === 'DEV' ||
    process.env.ENABLE_DEV_PAYMENT_SIMULATION === 'true' ||
    process.env.NODE_ENV === 'test';

  if (isDev) {
    if (process.env.NODE_ENV === 'production') {
      throw new ValidationError('Dev payment provider is strictly disallowed in production');
    }
    if (!defaultDevProvider) {
      defaultDevProvider = new DevPaymentProvider();
    }
    return defaultDevProvider;
  }

  if (!defaultRazorpayProvider) {
    defaultRazorpayProvider = new RazorpayProvider();
  }
  return defaultRazorpayProvider;
}

