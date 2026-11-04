import type { Request, Response, NextFunction } from 'express';
import { AdminDailyPhotosService } from './admin-daily-photos.service.js';
import {
  listDailyPhotoQueueQuerySchema,
  reviewDailyPhotoSchema,
  excuseDaySchema,
} from '@ap/shared-validation';
import { AppError } from '../../shared/errors/index.js';
import { ERROR_CODES, ROLES } from '@ap/shared-constants';

export class AdminDailyPhotosController {
  private static assertNotFinance(req: Request) {
    if (req.auth?.role === ROLES.FINANCE) {
      throw new AppError(
        ERROR_CODES.FORBIDDEN,
        403,
        'Finance role does not have permission to view or review daily photos',
      );
    }
  }

  static async getQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      AdminDailyPhotosController.assertNotFinance(req);
      const query = listDailyPhotoQueueQuerySchema.parse(req.query);
      const result = await AdminDailyPhotosService.getQueue(req.auth!.userId, query);
      res.status(200).json({ success: true, data: result.items, nextCursor: result.nextCursor });
    } catch (err) {
      next(err);
    }
  }

  static async claimNext(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      AdminDailyPhotosController.assertNotFinance(req);
      const result = await AdminDailyPhotosService.claimNext(req.auth!.userId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async claim(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      AdminDailyPhotosController.assertNotFinance(req);
      await AdminDailyPhotosService.claim(req.auth!.userId, req.params.id!);
      res.status(200).json({ success: true, message: 'Photo claimed successfully' });
    } catch (err) {
      next(err);
    }
  }

  static async release(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      AdminDailyPhotosController.assertNotFinance(req);
      await AdminDailyPhotosService.release(req.auth!.userId, req.params.id!);
      res.status(200).json({ success: true, message: 'Claim released successfully' });
    } catch (err) {
      next(err);
    }
  }

  static async getDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      AdminDailyPhotosController.assertNotFinance(req);
      const result = await AdminDailyPhotosService.getPhotoDetail(
        req.auth!.userId,
        req.params.id!,
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async decide(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      AdminDailyPhotosController.assertNotFinance(req);
      const parsedBody = reviewDailyPhotoSchema.parse(req.body);
      const result = await AdminDailyPhotosService.decide(
        req.auth!.userId,
        req.params.id!,
        parsedBody,
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async excuseDay(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      AdminDailyPhotosController.assertNotFinance(req);
      const parsedBody = excuseDaySchema.parse(req.body);
      await AdminDailyPhotosService.excuseDay(
        req.auth!.userId,
        req.params.id!,
        req.params.date!,
        parsedBody.reason,
      );
      res.status(200).json({ success: true, message: 'Day excused successfully' });
    } catch (err) {
      next(err);
    }
  }

  static async getFraudOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      AdminDailyPhotosController.assertNotFinance(req);
      const result = await AdminDailyPhotosService.getFraudOverview();
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getDriverTrust(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      AdminDailyPhotosController.assertNotFinance(req);
      const result = await AdminDailyPhotosService.getDriverTrust(req.params.id!);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

