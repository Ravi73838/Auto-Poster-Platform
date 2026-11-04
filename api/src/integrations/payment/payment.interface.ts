export interface CreateOrderParams {
  amountPaise: bigint;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface CreateOrderResult {
  gatewayOrderId: string;
  amountPaise: bigint;
  currency: string;
}

export interface VerifySignatureParams {
  orderId: string;
  paymentId: string;
  signature: string;
}

export interface FetchPaymentResult {
  status: 'captured' | 'authorized' | 'failed' | 'refunded';
  amountPaise: bigint;
  feePaise?: bigint;
  method?: string;
  capturedAt?: Date;
}

export interface RefundParams {
  paymentId: string;
  amountPaise: bigint;
  notes?: Record<string, string>;
}

export interface RefundResult {
  gatewayRefundId: string;
  status: string;
}

export interface PaymentProvider {
  createOrder(params: CreateOrderParams): Promise<CreateOrderResult>;
  verifyPaymentSignature(params: VerifySignatureParams): boolean;
  verifyWebhookSignature(rawBody: string, signature: string): boolean;
  fetchPayment(paymentId: string): Promise<FetchPaymentResult>;
  refundPayment(params: RefundParams): Promise<RefundResult>;
}

