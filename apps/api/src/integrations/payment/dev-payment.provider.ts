import crypto from 'node:crypto';
import { prisma } from '../../shared/db/index.js';
import type {
  PaymentProvider,
  CreateOrderParams,
  CreateOrderResult,
  VerifySignatureParams,
  FetchPaymentResult,
  RefundParams,
  RefundResult,
} from './payment.interface.js';

export class DevPaymentProvider implements PaymentProvider {
  private readonly secretKey: string;
  private readonly orders = new Map<string, { amountPaise: bigint; currency: string }>();
  private readonly payments = new Map<
    string,
    { status: 'captured' | 'authorized' | 'failed' | 'refunded'; amountPaise: bigint }
  >();

  constructor(secretKey = 'dev_payment_secret_key') {
    this.secretKey = secretKey;
  }

  async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    const gatewayOrderId = `order_dev_${crypto.randomBytes(8).toString('hex')}`;
    this.orders.set(gatewayOrderId, {
      amountPaise: params.amountPaise,
      currency: params.currency,
    });

    return {
      gatewayOrderId,
      amountPaise: params.amountPaise,
      currency: params.currency,
    };
  }

  generateDevSignature(orderId: string, paymentId: string): string {
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
  }

  verifyPaymentSignature(params: VerifySignatureParams): boolean {
    if (params.signature === 'dev_mock_signature') return true;
    const expected = this.generateDevSignature(params.orderId, params.paymentId);
    if (expected.length !== params.signature.length) return false;
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(params.signature),
    );
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const expected = crypto
      .createHmac('sha256', this.secretKey)
      .update(rawBody)
      .digest('hex');
    if (expected.length !== signature.length) return false;
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature),
    );
  }

  async fetchPayment(paymentId: string): Promise<FetchPaymentResult> {
    const record = this.payments.get(paymentId);
    if (record) {
      return {
        status: record.status,
        amountPaise: record.amountPaise,
        feePaise: 0n,
        method: 'upi',
        capturedAt: new Date(),
      };
    }

    // In dev: check orders created in memory
    for (const order of this.orders.values()) {
      return {
        status: 'captured',
        amountPaise: order.amountPaise,
        feePaise: 0n,
        method: 'upi',
        capturedAt: new Date(),
      };
    }

    const payment = await prisma.campaignPayment.findFirst({
      where: { status: 'CREATED' as const },
      orderBy: { createdAt: 'desc' },
    });

    return {
      status: 'captured',
      amountPaise: payment?.amountPaise ?? 0n,
      feePaise: 0n,
      method: 'upi',
      capturedAt: new Date(),
    };
  }

  async refundPayment(params: RefundParams): Promise<RefundResult> {
    const gatewayRefundId = `rfnd_dev_${crypto.randomBytes(8).toString('hex')}`;
    return {
      gatewayRefundId,
      status: 'processed',
    };
  }
}
