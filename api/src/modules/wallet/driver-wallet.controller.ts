import type { Request, Response, NextFunction } from 'express';
import { DriverWalletService } from './driver-wallet.service.js';
import { driverWithdrawalSchema } from '@ap/shared-validation';
import { prisma, paginateQuery, getPaginationMeta } from '../../shared/db/index.js';
import { NotFoundError } from '../../shared/errors/index.js';

export class DriverWalletController {
  static async getWallet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await DriverWalletService.getWallet(req.auth!.userId);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async getStatement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20;
      const result = await DriverWalletService.getStatement(req.auth!.userId, { page, pageSize });

      res.status(200).json({
        success: true,
        data: result.entries.map((e) => ({
          id: e.id,
          transactionId: e.transactionId,
          direction: e.direction,
          amountPaise: e.amountPaise.toString(),
          balanceAfterPaise: e.balanceAfterPaise.toString(),
          createdAt: e.createdAt,
        })),
        meta: result.meta,
      });
    } catch (err) {
      next(err);
    }
  }

  static async requestWithdrawal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = driverWithdrawalSchema.parse(req.body);
      const payout = await DriverWalletService.requestWithdrawal(
        req.auth!.userId,
        BigInt(input.amountPaise),
        input.idempotencyKey,
      );

      res.status(201).json({
        success: true,
        data: {
          id: payout.id,
          amountPaise: payout.amountPaise.toString(),
          method: payout.method,
          status: payout.status,
          requestedAt: payout.requestedAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async listPayouts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payouts = await prisma.payout.findMany({
        where: { driverId: req.auth!.userId },
        orderBy: { requestedAt: 'desc' },
      });

      res.status(200).json({
        success: true,
        data: payouts.map((p) => ({
          id: p.id,
          amountPaise: p.amountPaise.toString(),
          method: p.method,
          status: p.status,
          payoutType: p.payoutType,
          utr: p.utr,
          failureReason: p.failureReason,
          requestedAt: p.requestedAt,
          processedAt: p.processedAt,
        })),
      });
    } catch (err) {
      next(err);
    }
  }

  static async getAssignmentSettlement(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const settlement = await prisma.assignmentSettlement.findUnique({
        where: { assignmentId: req.params.id },
      });

      if (!settlement) {
        throw new NotFoundError(`Settlement for assignment ${req.params.id} not found`);
      }

      res.status(200).json({
        success: true,
        data: {
          id: settlement.id,
          assignmentId: settlement.assignmentId,
          status: settlement.status,
          totalDays: settlement.totalDays,
          verifiedDays: settlement.verifiedDays,
          missedDays: settlement.missedDays,
          graceDaysUsed: settlement.graceDaysUsed,
          payableDays: settlement.payableDays,
          dailyRentPaise: settlement.dailyRentPaise.toString(),
          rentPayablePaise: settlement.rentPayablePaise.toString(),
          printingAllowancePaise: settlement.printingAllowancePaise.toString(),
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

