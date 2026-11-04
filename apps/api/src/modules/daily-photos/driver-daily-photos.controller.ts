import type { Request, Response, NextFunction } from 'express';
import { DailyPhotosService } from './daily-photos.service.js';
import { AssignmentDaysService } from '../assignment-days/assignment-days.service.js';
import { submitDailyPhotoSchema } from '@ap/shared-validation';

export class DriverDailyPhotosController {
  static async submitDailyPhoto(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedBody = submitDailyPhotoSchema.parse(req.body);
      const result = await DailyPhotosService.submitDailyPhoto(
        req.auth!.userId,
        req.params.id!,
        parsedBody,
      );
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getTodayStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await DailyPhotosService.getTodayStatus(
        req.auth!.userId,
        req.params.id!,
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getDays(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AssignmentDaysService.getDaysSummary(req.params.id!);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async listPhotos(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const result = await DailyPhotosService.listDriverDailyPhotos(
        req.auth!.userId,
        req.params.id!,
        page,
        limit,
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}
