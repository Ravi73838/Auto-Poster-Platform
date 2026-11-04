import {
  CAMPAIGN_STATUS,
  PAYMENT_STATUS,
  SETTING_KEYS,
} from '@ap/shared-constants';
import type { CampaignPayment, TaxDocument } from '@prisma/client';
import { prisma, withTransaction } from '../../shared/db/index.js';
import { SettingsService } from '../settings/settings.service.js';
import { getPaymentProvider, type PaymentProvider } from '../../integrations/payment/index.js';
import { postPaymentCaptured, postGatewayFee } from '../ledger/recipes/index.js';
import { TaxDocumentService } from '../tax-documents/tax-document.service.js';
import { emitEvent } from '../../events/index.js';
import {
  NotFoundError,
  ValidationError,
  AppError,
  DuplicateRequestError,
} from '../../shared/errors/index.js';
import { logger } from '../../shared/logger/index.js';
import type { PaymentOrderResultDto } from '@ap/shared-types';
import type { VerifyPaymentSignatureInput } from '@ap/shared-validation';

export class CampaignPaymentService {
  /**
   * Creates or retrieves a payment order for a campaign.
   */
  static async createPaymentOrder(
    campaignId: string,
    companyId: string,
    idempotencyKey?: string,
  ): Promise<PaymentOrderResultDto> {
    const paymentsEnabled = await SettingsService.get(
      SETTING_KEYS.FINANCE_PAYMENTS_ENABLED,
      true,
    );
    if (!paymentsEnabled) {
      throw new AppError('PAYMENTS_DISABLED', 'Online payments are currently disabled', 503);
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!campaign) {
      throw new NotFoundError(`Campaign ${campaignId} not found`);
    }

    if (campaign.companyId !== companyId) {
      throw new ValidationError('You do not own this campaign');
    }

    if (
      campaign.status === CAMPAIGN_STATUS.LIVE ||
      campaign.status === CAMPAIGN_STATUS.RUNNING ||
      campaign.status === CAMPAIGN_STATUS.COMPLETED
    ) {
      throw new AppError(
        'PAYMENT_ALREADY_CAPTURED',
        'This campaign has already been paid for and is active',
        400,
      );
    }

    if (
      campaign.status !== CAMPAIGN_STATUS.APPROVED &&
      campaign.status !== CAMPAIGN_STATUS.AWAITING_PAYMENT
    ) {
      throw new AppError(
        'CAMPAIGN_NOT_READY_FOR_PAYMENT',
        `Campaign status "${campaign.status}" cannot accept payment`,
        400,
      );
    }

    const latestPayment = campaign.payments[0];

    // Reuse existing valid order if not expired
    if (
      latestPayment &&
      latestPayment.status === PAYMENT_STATUS.CREATED &&
      latestPayment.gatewayOrderId &&
      latestPayment.orderExpiresAt &&
      latestPayment.orderExpiresAt > new Date()
    ) {
      return {
        paymentId: latestPayment.id,
        campaignId: campaign.id,
        amountPaise: latestPayment.amountPaise.toString(),
        currency: latestPayment.currency,
        gateway: latestPayment.gateway,
        gatewayOrderId: latestPayment.gatewayOrderId,
        orderExpiresAt: latestPayment.orderExpiresAt.toISOString(),
      };
    }

    const provider: PaymentProvider = getPaymentProvider();
    const orderExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const orderResult = await provider.createOrder({
      amountPaise: campaign.totalChargedPaise,
      currency: 'INR',
      receipt: `rcpt_${campaign.id.slice(0, 8)}`,
      notes: {
        campaignId: campaign.id,
        companyId,
      },
    });

    const payment = await withTransaction(async (tx) => {
      // Transition campaign to AWAITING_PAYMENT if currently APPROVED
      if (campaign.status === CAMPAIGN_STATUS.APPROVED) {
        await tx.campaign.update({
          where: { id: campaign.id },
          data: { status: CAMPAIGN_STATUS.AWAITING_PAYMENT },
        });
      }

      return tx.campaignPayment.create({
        data: {
          campaignId: campaign.id,
          companyId,
          amountPaise: campaign.totalChargedPaise,
          currency: 'INR',
          gateway: 'DEV',
          gatewayOrderId: orderResult.gatewayOrderId,
          status: PAYMENT_STATUS.CREATED,
          idempotencyKey: idempotencyKey ?? `order:${campaign.id}:${Date.now()}`,
          orderExpiresAt,
        },
      });
    });

    return {
      paymentId: payment.id,
      campaignId: campaign.id,
      amountPaise: payment.amountPaise.toString(),
      currency: payment.currency,
      gateway: payment.gateway,
      gatewayOrderId: orderResult.gatewayOrderId,
      orderExpiresAt: orderExpiresAt.toISOString(),
    };
  }

  /**
   * Verifies payment signature and marks campaign as paid and live.
   */
  static async verifyPayment(
    input: VerifyPaymentSignatureInput,
    companyId: string,
  ): Promise<{
    payment: CampaignPayment;
    taxDocument: TaxDocument;
  }> {
    const payment = await prisma.campaignPayment.findUnique({
      where: { id: input.paymentId },
      include: { campaign: true },
    });

    if (!payment) {
      throw new NotFoundError(`Payment ${input.paymentId} not found`);
    }

    if (payment.companyId !== companyId) {
      throw new ValidationError('You do not own this payment transaction');
    }

    if (payment.status === PAYMENT_STATUS.PAID) {
      const taxDoc = await prisma.taxDocument.findFirst({
        where: { paymentId: payment.id },
      });
      return { payment, taxDocument: taxDoc! };
    }

    const provider: PaymentProvider = getPaymentProvider(payment.gateway);

    const isSignatureValid = provider.verifyPaymentSignature({
      orderId: input.gatewayOrderId,
      paymentId: input.gatewayPaymentId,
      signature: input.gatewaySignature,
    });

    if (!isSignatureValid) {
      await prisma.campaignPayment.update({
        where: { id: payment.id },
        data: { status: PAYMENT_STATUS.FAILED },
      });
      throw new AppError('PAYMENT_SIGNATURE_INVALID', 'Invalid payment signature', 400);
    }

    const paymentDetails = await provider.fetchPayment(input.gatewayPaymentId);

    if (paymentDetails.amountPaise !== payment.amountPaise) {
      throw new AppError(
        'PAYMENT_AMOUNT_MISMATCH',
        `Payment amount mismatch: expected ${payment.amountPaise}, got ${paymentDetails.amountPaise}`,
        400,
      );
    }

    const result = await withTransaction(async (tx) => {
      // 1. Post Recipe 1: Payment Captured (Clearing -> Escrow)
      await postPaymentCaptured(
        {
          paymentId: payment.id,
          campaignId: payment.campaignId,
          amountPaise: payment.amountPaise,
          metadata: {
            gatewayOrderId: input.gatewayOrderId,
            gatewayPaymentId: input.gatewayPaymentId,
          },
        },
        tx,
      );

      // 2. Post Recipe 7: Gateway Fee if present
      if (paymentDetails.feePaise && paymentDetails.feePaise > 0n) {
        await postGatewayFee(
          {
            paymentId: payment.id,
            feePaise: paymentDetails.feePaise,
          },
          tx,
        );
      }

      // 3. Update payment record
      const updatedPayment = await tx.campaignPayment.update({
        where: { id: payment.id },
        data: {
          status: PAYMENT_STATUS.PAID,
          gatewayPaymentId: input.gatewayPaymentId,
          gatewaySignature: input.gatewaySignature,
          capturedAt: paymentDetails.capturedAt ?? new Date(),
          signatureVerifiedAt: new Date(),
          method: paymentDetails.method ?? 'upi',
          gatewayFeePaise: paymentDetails.feePaise ?? 0n,
        },
      });

      // 4. Update campaign status to LIVE
      const today = new Date();
      const newStatus =
        today >= payment.campaign.startDate
          ? CAMPAIGN_STATUS.RUNNING
          : CAMPAIGN_STATUS.LIVE;

      await tx.campaign.update({
        where: { id: payment.campaignId },
        data: {
          status: newStatus,
          liveAt: new Date(),
        },
      });

      // 5. Generate Tax Invoice
      const taxDocument = await TaxDocumentService.generateTaxInvoice(payment.id, tx);

      return { payment: updatedPayment, taxDocument };
    });

    // 6. Emit event outside transaction
    await emitEvent('campaign.paid', {
      campaignId: payment.campaignId,
      companyId: payment.companyId,
      amountPaise: payment.amountPaise.toString(),
      paymentId: payment.id,
    });

    return result;
  }

  /**
   * Handles payment gateway webhooks idempotently.
   */
  static async processWebhook(
    rawBody: string,
    signature: string,
    gateway = 'razorpay',
  ): Promise<{ status: string }> {
    const provider = getPaymentProvider(gateway);
    const isValid = provider.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      throw new AppError('PAYMENT_SIGNATURE_INVALID', 'Invalid webhook signature', 400);
    }

    const payload = JSON.parse(rawBody) as {
      id?: string;
      event?: string;
      payload?: {
        payment?: { entity?: { id: string; order_id: string; amount: number; status: string } };
      };
    };

    const eventId = payload.id ?? `evt_${Date.now()}`;
    const eventType = payload.event ?? 'unknown';

    // Idempotent record
    const existing = await prisma.webhookEvent.findUnique({
      where: { gateway_eventId: { gateway, eventId } },
    });

    if (existing && existing.processedAt) {
      return { status: 'already_processed' };
    }

    const webhookEvent = await prisma.webhookEvent.upsert({
      where: { gateway_eventId: { gateway, eventId } },
      create: {
        gateway,
        eventId,
        eventType,
        payload: payload as object,
      },
      update: {
        attempts: { increment: 1 },
      },
    });

    try {
      if (eventType === 'payment.captured' || eventType === 'order.paid') {
        const paymentEntity = payload.payload?.payment?.entity;
        if (paymentEntity?.order_id) {
          const payment = await prisma.campaignPayment.findFirst({
            where: { gatewayOrderId: paymentEntity.order_id },
            include: { campaign: true },
          });

          if (payment && payment.status !== PAYMENT_STATUS.PAID) {
            await this.verifyPayment(
              {
                paymentId: payment.id,
                gatewayOrderId: paymentEntity.order_id,
                gatewayPaymentId: paymentEntity.id,
                gatewaySignature: 'webhook_verified',
              },
              payment.companyId,
            );
          }
        }
      }

      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { processedAt: new Date() },
      });

      return { status: 'processed' };
    } catch (err: unknown) {
      logger.error({ err, eventId }, 'Error processing webhook event');
      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { error: (err as Error).message },
      });
      throw err;
    }
  }
}
