import crypto from 'node:crypto';
import type {
  PaymentProvider,
  CreateOrderParams,
  CreateOrderResult,
  VerifySignatureParams,
  FetchPaymentResult,
  RefundParams,
  RefundResult,
} from './payment.interface.js';
import { env } from '../../config/env.js';
import { logger } from '../../shared/logger/index.js';
import { ExternalServiceError } from '../../shared/errors/index.js';

export class RazorpayProvider implements PaymentProvider {
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;

  constructor(
    keyId = process.env.RAZORPAY_KEY_ID ?? '',
    keySecret = process.env.RAZORPAY_KEY_SECRET ?? '',
    webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ?? '',
  ) {
    this.keyId = keyId;
    this.keySecret = keySecret;
    this.webhookSecret = webhookSecret;
  }

  async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    if (!this.keyId || !this.keySecret) {
      throw new ExternalServiceError('Razorpay credentials not configured');
    }

    try {
      const basicAuth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${basicAuth}`,
        },
        body: JSON.stringify({
          amount: Number(params.amountPaise),
          currency: params.currency,
          receipt: params.receipt,
          notes: params.notes,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({ errorText, status: response.status }, 'Razorpay create order failed');
        throw new ExternalServiceError(`Razorpay create order failed with status ${response.status}`);
      }

      const data = (await response.json()) as { id: string; amount: number; currency: string };
      return {
        gatewayOrderId: data.id,
        amountPaise: BigInt(data.amount),
        currency: data.currency,
      };
    } catch (err: unknown) {
      logger.error({ err }, 'Error calling Razorpay createOrder API');
      throw new ExternalServiceError('Failed to create Razorpay order');
    }
  }

  verifyPaymentSignature(params: VerifySignatureParams): boolean {
    if (!this.keySecret) return false;
    const body = `${params.orderId}|${params.paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.keySecret)
      .update(body)
      .digest('hex');

    if (expectedSignature.length !== params.signature.length) return false;
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(params.signature),
    );
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const secret = this.webhookSecret || this.keySecret;
    if (!secret) return false;
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    if (expected.length !== signature.length) return false;
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature),
    );
  }

  async fetchPayment(paymentId: string): Promise<FetchPaymentResult> {
    if (!this.keyId || !this.keySecret) {
      throw new ExternalServiceError('Razorpay credentials not configured');
    }

    try {
      const basicAuth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
      const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
        headers: {
          Authorization: `Basic ${basicAuth}`,
        },
      });

      if (!response.ok) {
        throw new ExternalServiceError(`Failed to fetch payment details: ${response.status}`);
      }

      const data = (await response.json()) as {
        status: string;
        amount: number;
        fee?: number;
        method?: string;
        created_at: number;
      };

      return {
        status: data.status === 'captured' ? 'captured' : data.status === 'authorized' ? 'authorized' : 'failed',
        amountPaise: BigInt(data.amount),
        feePaise: data.fee ? BigInt(data.fee) : undefined,
        method: data.method,
        capturedAt: new Date(data.created_at * 1000),
      };
    } catch (err: unknown) {
      logger.error({ err, paymentId }, 'Error fetching payment from Razorpay');
      throw new ExternalServiceError('Failed to verify payment with Razorpay');
    }
  }

  async refundPayment(params: RefundParams): Promise<RefundResult> {
    if (!this.keyId || !this.keySecret) {
      throw new ExternalServiceError('Razorpay credentials not configured');
    }

    try {
      const basicAuth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
      const response = await fetch(`https://api.razorpay.com/v1/payments/${params.paymentId}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${basicAuth}`,
        },
        body: JSON.stringify({
          amount: Number(params.amountPaise),
          notes: params.notes,
        }),
      });

      if (!response.ok) {
        throw new ExternalServiceError(`Razorpay refund failed: ${response.status}`);
      }

      const data = (await response.json()) as { id: string; status: string };
      return {
        gatewayRefundId: data.id,
        status: data.status,
      };
    } catch (err: unknown) {
      logger.error({ err, paymentId: params.paymentId }, 'Error processing Razorpay refund');
      throw new ExternalServiceError('Failed to execute Razorpay refund');
    }
  }
}

