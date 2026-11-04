import {
  REFUND_STATUS,
  REFUND_REASONS,
  type RefundReason,
  type RefundStatus,
} from '@ap/shared-constants';
import type { Refund, TaxDocument } from '@prisma/client';
import { prisma, withTransaction } from '../../shared/db/index.js';
import { postRefundReserve, postRefundPayout } from '../ledger/recipes/index.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { AccountDirectory } from '../ledger/account-directory.js';
import { TaxDocumentService } from '../tax-documents/tax-document.service.js';
import { getPaymentProvider } from '../../integrations/payment/index.js';
import {
  NotFoundError,
  ValidationError,
  AppError,
} from '../../shared/errors/index.js';
import { logger } from '../../shared/logger/index.js';

export interface RequestRefundInput {
  campaignId: string;
  amountPaise: bigint;
  reason: RefundReason;
  notes?: string;
  paymentId?: string;
  idempotencyKey?: string;
}

export class RefundService {
  /**
   * Submits a refund request.
   */
  static async requestRefund(
    input: RequestRefundInput,
    requestedById: string,
  ): Promise<Refund> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: input.campaignId },
    });

    if (!campaign) {
      throw new NotFoundError(`Campaign ${input.campaignId} not found`);
    }

    const escrow = await AccountDirectory.getCampaignEscrowAccount(campaign.id);
    const availableEscrow = await LedgerService.getBalance(escrow.id);

    if (availableEscrow < input.amountPaise) {
      throw new AppError(
        'REFUND_EXCEEDS_ESCROW',
        `Refund amount (${input.amountPaise} paise) exceeds available escrow (${availableEscrow} paise)`,
        400,
      );
    }

    return prisma.refund.create({
      data: {
        campaignId: campaign.id,
        companyId: campaign.companyId,
        paymentId: input.paymentId ?? null,
        amountPaise: input.amountPaise,
        reason: input.reason,
        status: REFUND_STATUS.PENDING,
        notes: input.notes ?? null,
        requestedById,
        idempotencyKey: input.idempotencyKey ?? `refund-req:${campaign.id}:${Date.now()}`,
      },
    });
  }

  /**
   * Approves a refund request with Maker-Checker verification.
   */
  static async approveRefund(
    refundId: string,
    approvedById: string,
  ): Promise<{ refund: Refund; creditNote: TaxDocument }> {
    const refund = await prisma.refund.findUnique({
      where: { id: refundId },
      include: {
        campaign: true,
        payment: true,
      },
    });

    if (!refund) {
      throw new NotFoundError(`Refund ${refundId} not found`);
    }

    if (refund.status !== REFUND_STATUS.PENDING) {
      throw new AppError(
        'REFUND_ALREADY_PROCESSED',
        `Refund is in status "${refund.status}" and cannot be approved`,
        400,
      );
    }

    // Maker-Checker enforcement: Requester cannot approve their own refund request!
    if (refund.requestedById === approvedById) {
      throw new AppError(
        'MAKER_CHECKER_VIOLATION',
        'Maker-checker violation: Requester and approver must be different users',
        403,
      );
    }

    const escrow = await AccountDirectory.getCampaignEscrowAccount(refund.campaignId);
    const availableEscrow = await LedgerService.getBalance(escrow.id);

    if (availableEscrow < refund.amountPaise) {
      throw new AppError(
        'REFUND_EXCEEDS_ESCROW',
        `Available escrow balance (${availableEscrow} paise) is insufficient for refund (${refund.amountPaise} paise)`,
        400,
      );
    }

    // 1. Transactional ledger reserve and credit note generation
    const { updatedRefund, creditNote } = await withTransaction(async (tx) => {
      // Recipe 4A: Escrow -> Company Refund Liability
      await postRefundReserve(
        {
          refundId: refund.id,
          campaignId: refund.campaignId,
          amountPaise: refund.amountPaise,
          metadata: { approvedById },
        },
        tx,
      );

      // Generate Credit Note
      const cn = await TaxDocumentService.generateCreditNote(refund.id, tx);

      const upd = await tx.refund.update({
        where: { id: refund.id },
        data: {
          status: REFUND_STATUS.PROCESSING,
          approvedById,
          creditNoteId: cn.id,
        },
      });

      return { updatedRefund: upd, creditNote: cn };
    });

    // 2. Gateway processing
    try {
      if (refund.payment?.gatewayPaymentId) {
        const provider = getPaymentProvider(refund.payment.gateway);
        const refundResult = await provider.refundPayment({
          paymentId: refund.payment.gatewayPaymentId,
          amountPaise: refund.amountPaise,
          notes: {
            refundId: refund.id,
            reason: refund.reason,
          },
        });

        // Recipe 4B: Payout executed by gateway
        await postRefundPayout({
          refundId: refund.id,
          amountPaise: refund.amountPaise,
        });

        const succeededRefund = await prisma.refund.update({
          where: { id: refund.id },
          data: {
            status: REFUND_STATUS.SUCCEEDED,
            gatewayRefundId: refundResult.gatewayRefundId,
          },
        });

        return { refund: succeededRefund, creditNote };
      } else {
        // If no gateway payment id (e.g. manual/direct), mark succeeded directly
        await postRefundPayout({
          refundId: refund.id,
          amountPaise: refund.amountPaise,
        });

        const succeededRefund = await prisma.refund.update({
          where: { id: refund.id },
          data: {
            status: REFUND_STATUS.SUCCEEDED,
          },
        });

        return { refund: succeededRefund, creditNote };
      }
    } catch (err: unknown) {
      logger.error({ err, refundId }, 'Gateway refund processing failed');
      // Remains in PROCESSING or FAILED for retry job
      const failedRefund = await prisma.refund.update({
        where: { id: refund.id },
        data: { status: REFUND_STATUS.FAILED },
      });
      return { refund: failedRefund, creditNote };
    }
  }

  /**
   * Rejects a refund request.
   */
  static async rejectRefund(
    refundId: string,
    rejectedById: string,
    rejectionReason: string,
  ): Promise<Refund> {
    const refund = await prisma.refund.findUnique({
      where: { id: refundId },
    });

    if (!refund) {
      throw new NotFoundError(`Refund ${refundId} not found`);
    }

    if (refund.status !== REFUND_STATUS.PENDING) {
      throw new AppError(
        'REFUND_ALREADY_PROCESSED',
        `Refund is in status "${refund.status}" and cannot be rejected`,
        400,
      );
    }

    if (refund.requestedById === rejectedById) {
      throw new AppError(
        'MAKER_CHECKER_VIOLATION',
        'Maker-checker violation: Requester and rejecter must be different users',
        403,
      );
    }

    return prisma.refund.update({
      where: { id: refund.id },
      data: {
        status: REFUND_STATUS.REJECTED,
        rejectedById,
        rejectionReason,
      },
    });
  }

  /**
   * Executes a system-automated refund (for unfilled slots or campaign cancellation).
   */
  static async createAndExecuteSystemRefund(
    campaignId: string,
    amountPaise: bigint,
    reason: RefundReason,
    systemActorId: string,
    notes?: string,
  ): Promise<Refund | null> {
    if (amountPaise <= 0n) return null;

    const escrow = await AccountDirectory.getCampaignEscrowAccount(campaignId);
    const balance = await LedgerService.getBalance(escrow.id);
    const actualRefundAmount = balance < amountPaise ? balance : amountPaise;

    if (actualRefundAmount <= 0n) return null;

    const refund = await prisma.refund.create({
      data: {
        campaignId,
        companyId: (await prisma.campaign.findUnique({ where: { id: campaignId } }))!.companyId,
        amountPaise: actualRefundAmount,
        reason,
        status: REFUND_STATUS.SUCCEEDED,
        notes: notes ?? 'System automated refund',
        requestedById: systemActorId,
        approvedById: systemActorId,
        idempotencyKey: `sys-refund:${campaignId}:${reason}:${actualRefundAmount}`,
      },
    });

    // Execute Recipe 4A & 4B
    await postRefundReserve({
      refundId: refund.id,
      campaignId,
      amountPaise: actualRefundAmount,
    });

    await postRefundPayout({
      refundId: refund.id,
      amountPaise: actualRefundAmount,
    });

    const cn = await TaxDocumentService.generateCreditNote(refund.id);
    await prisma.refund.update({
      where: { id: refund.id },
      data: { creditNoteId: cn.id },
    });

    return refund;
  }
}

