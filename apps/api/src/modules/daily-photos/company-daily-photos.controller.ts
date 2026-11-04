import type { Request, Response, NextFunction } from 'express';
import { CompanyDailyPhotosService } from './company-daily-photos.service.js';
import { flagPhotoSchema } from '@ap/shared-validation';

export class CompanyDailyPhotosController {
  static async getProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await CompanyDailyPhotosService.getProgress(
        req.auth!.userId,
        req.params.id!,
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async listPhotos(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const date = req.query.date as string | undefined;

      const result = await CompanyDailyPhotosService.listPhotos(
        req.auth!.userId,
        req.params.id!,
        page,
        limit,
        date,
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getMapPoints(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const date = req.query.date as string | undefined;
      const result = await CompanyDailyPhotosService.getMapPoints(
        req.auth!.userId,
        req.params.id!,
        date,
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async flagPhoto(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedBody = flagPhotoSchema.parse(req.body);
      const result = await CompanyDailyPhotosService.flagPhoto(
        req.auth!.userId,
        req.params.id!,
        req.params.photoId!,
        parsedBody,
      );
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getCsvReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const csv = await CompanyDailyPhotosService.generateCsvReport(
        req.auth!.userId,
        req.params.id!,
      );
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="campaign-${req.params.id}-progress.csv"`);
      res.status(200).send(csv);
    } catch (err) {
      next(err);
    }
  }
}

