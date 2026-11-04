import type { Request, Response, NextFunction } from 'express';
import { AdminFinanceService } from './admin-finance.service.js';
import { RefundService } from '../../refunds/refund.service.js';
import { SettlementService } from '../../settlements/settlement.service.js';
import { LedgerInvariantService } from '../../ledger/ledger-invariant.service.js';
import { LedgerService } from '../../ledger/ledger.service.js';
import { prisma, paginateQuery, getPaginationMeta } from '../../../shared/db/index.js';
import {
  adjustmentRequestSchema,
  adjustmentReviewSchema,
  financePauseSchema,
  refundRequestSchema,
  refundReviewSchema,
  settlementApprovalSchema,
} from '@ap/shared-validation';
import { NotFoundError } from '../../../shared/errors/index.js';

export class AdminFinanceController {
  static async getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await AdminFinanceService.getDashboard();
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async togglePause(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = financePauseSchema.parse(req.body);
      const data = await AdminFinanceService.togglePause(input, req.auth!.userId);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async listPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20;
      const campaignId = req.query.campaignId as string | undefined;
      const status = req.query.status as any;

      const where: any = {};
      if (campaignId) where.campaignId = campaignId;
      if (status) where.status = status;

      const total = await prisma.campaignPayment.count({ where });
      const meta = getPaginationMeta(total, { page, pageSize });
      const { skip, take } = paginateQuery({ page, pageSize });

      const payments = await prisma.campaignPayment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          campaign: { select: { title: true } },
          company: { select: { mobile: true, email: true } },
        },
      });

      res.status(200).json({
        success: true,
        data: payments.map((p) => ({
          id: p.id,
          campaignId: p.campaignId,
          campaignTitle: p.campaign.title,
          companyId: p.companyId,
          amountPaise: p.amountPaise.toString(),
          gateway: p.gateway,
          status: p.status,
          method: p.method,
          capturedAt: p.capturedAt,
          createdAt: p.createdAt,
        })),
        meta,
      });
    } catch (err) {
      next(err);
    }
  }

  static async listRefunds(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20;

      const total = await prisma.refund.count();
      const meta = getPaginationMeta(total, { page, pageSize });
      const { skip, take } = paginateQuery({ page, pageSize });

      const refunds = await prisma.refund.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          campaign: { select: { title: true } },
        },
      });

      res.status(200).json({
        success: true,
        data: refunds.map((r) => ({
          id: r.id,
          campaignId: r.campaignId,
          campaignTitle: r.campaign.title,
          amountPaise: r.amountPaise.toString(),
          reason: r.reason,
          status: r.status,
          requestedById: r.requestedById,
          approvedById: r.approvedById,
          createdAt: r.createdAt,
        })),
        meta,
      });
    } catch (err) {
      next(err);
    }
  }

  static async requestRefund(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = refundRequestSchema.parse(req.body);
      const refund = await RefundService.requestRefund(
        {
          campaignId: input.campaignId,
          amountPaise: BigInt(input.amountPaise),
          reason: input.reason,
          notes: input.notes,
          idempotencyKey: input.idempotencyKey,
        },
        req.auth!.userId,
      );
      res.status(201).json({ success: true, data: refund });
    } catch (err) {
      next(err);
    }
  }

  static async reviewRefund(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = refundReviewSchema.parse(req.body);
      if (input.decision === 'APPROVED') {
        const result = await RefundService.approveRefund(req.params.id!, req.auth!.userId);
        res.status(200).json({ success: true, data: result });
      } else {
        const result = await RefundService.rejectRefund(
          req.params.id!,
          req.auth!.userId,
          input.rejectionReason ?? 'Rejected by finance admin',
        );
        res.status(200).json({ success: true, data: result });
      }
    } catch (err) {
      next(err);
    }
  }

  static async listSettlements(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settlements = await prisma.assignmentSettlement.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          campaign: { select: { title: true } },
          driver: { select: { mobile: true } },
        },
      });

      res.status(200).json({
        success: true,
        data: settlements.map((s) => ({
          id: s.id,
          assignmentId: s.assignmentId,
          campaignId: s.campaignId,
          campaignTitle: s.campaign.title,
          driverId: s.driverId,
          driverMobile: s.driver.mobile,
          status: s.status,
          totalDays: s.totalDays,
          verifiedDays: s.verifiedDays,
          missedDays: s.missedDays,
          payableDays: s.payableDays,
          rentPayablePaise: s.rentPayablePaise.toString(),
          companyRefundPaise: s.companyRefundPaise.toString(),
          anomalyFlags: s.anomalyFlags,
          holdReason: s.holdReason,
          createdAt: s.createdAt,
        })),
      });
    } catch (err) {
      next(err);
    }
  }

  static async reviewSettlement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = settlementApprovalSchema.parse(req.body);
      if (input.decision === 'APPROVE') {
        const updated = await SettlementService.approveSettlement(
          req.params.id!,
          req.auth!.userId,
          true, // override hold if manually approved
        );
        res.status(200).json({ success: true, data: updated });
      } else {
        const updated = await prisma.assignmentSettlement.update({
          where: { id: req.params.id },
          data: {
            status: 'HOLD',
            holdReason: input.holdReason,
          },
        });
        res.status(200).json({ success: true, data: updated });
      }
    } catch (err) {
      next(err);
    }
  }

  static async closeoutCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await SettlementService.closeoutCampaign(req.params.id!, req.auth!.userId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async listPayouts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payouts = await prisma.payout.findMany({
        orderBy: { requestedAt: 'desc' },
        include: {
          driver: { select: { mobile: true } },
        },
      });

      res.status(200).json({
        success: true,
        data: payouts.map((p) => ({
          id: p.id,
          driverId: p.driverId,
          driverMobile: p.driver.mobile,
          amountPaise: p.amountPaise.toString(),
          method: p.method,
          status: p.status,
          payoutType: p.payoutType,
          utr: p.utr,
          requestedAt: p.requestedAt,
        })),
      });
    } catch (err) {
      next(err);
    }
  }

  static async exportPayoutsCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AdminFinanceService.exportPayoutBatch(req.auth!.userId);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${result.batch.batchNumber}.csv"`);
      res.send(result.csv);
    } catch (err) {
      next(err);
    }
  }

  static async importPayoutsCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const csvContent = typeof req.body === 'string' ? req.body : req.body.csv;
      const result = await AdminFinanceService.importPayoutCsvResult(csvContent, req.auth!.userId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async listAccounts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const accounts = await prisma.ledgerAccount.findMany({
        orderBy: { code: 'asc' },
      });

      const accountsWithBalance = await Promise.all(
        accounts.map(async (acc) => {
          const balance = await LedgerService.getBalance(acc.id);
          return {
            id: acc.id,
            code: acc.code,
            accountType: acc.accountType,
            currency: acc.currency,
            userId: acc.userId,
            campaignId: acc.campaignId,
            balancePaise: balance.toString(),
            isActive: acc.isActive,
          };
        }),
      );

      res.status(200).json({ success: true, data: accountsWithBalance });
    } catch (err) {
      next(err);
    }
  }

  static async listTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20;

      const total = await prisma.ledgerTransaction.count();
      const meta = getPaginationMeta(total, { page, pageSize });
      const { skip, take } = paginateQuery({ page, pageSize });

      const txs = await prisma.ledgerTransaction.findMany({
        orderBy: { postedAt: 'desc' },
        skip,
        take,
        include: {
          entries: {
            include: { account: true },
          },
        },
      });

      res.status(200).json({
        success: true,
        data: txs.map((t) => ({
          id: t.id,
          refType: t.refType,
          refId: t.refId,
          description: t.description,
          idempotencyKey: t.idempotencyKey,
          postedAt: t.postedAt,
          entries: t.entries.map((e) => ({
            id: e.id,
            accountCode: e.account.code,
            accountType: e.account.accountType,
            direction: e.direction,
            amountPaise: e.amountPaise.toString(),
            balanceAfterPaise: e.balanceAfterPaise.toString(),
          })),
        })),
        meta,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getTrialBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await LedgerInvariantService.verifyTrialBalance();
      res.status(200).json({
        success: true,
        data: {
          asOf: result.asOf,
          isBalanced: result.isBalanced,
          totalDebitsPaise: result.totalDebitsPaise.toString(),
          totalCreditsPaise: result.totalCreditsPaise.toString(),
          diffPaise: result.diffPaise.toString(),
          accounts: result.accounts.map((a) => ({
            accountId: a.accountId,
            code: a.code,
            accountType: a.accountType,
            debitPaise: a.debitPaise.toString(),
            creditPaise: a.creditPaise.toString(),
            netBalancePaise: a.netBalancePaise.toString(),
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async listAdjustments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adjustments = await prisma.adjustment.findMany({
        orderBy: { createdAt: 'desc' },
        include: { account: true },
      });

      res.status(200).json({
        success: true,
        data: adjustments.map((a) => ({
          id: a.id,
          accountId: a.accountId,
          accountCode: a.account.code,
          amountPaise: a.amountPaise.toString(),
          direction: a.direction,
          reason: a.reason,
          status: a.status,
          requestedById: a.requestedById,
          approvedById: a.approvedById,
          createdAt: a.createdAt,
        })),
      });
    } catch (err) {
      next(err);
    }
  }

  static async requestAdjustment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = adjustmentRequestSchema.parse(req.body);
      const adj = await AdminFinanceService.requestAdjustment(input, req.auth!.userId);
      res.status(201).json({ success: true, data: adj });
    } catch (err) {
      next(err);
    }
  }

  static async reviewAdjustment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = adjustmentReviewSchema.parse(req.body);
      const adj = await AdminFinanceService.reviewAdjustment(
        req.params.id!,
        input,
        req.auth!.userId,
      );
      res.status(200).json({ success: true, data: adj });
    } catch (err) {
      next(err);
    }
  }
}

