import type { Request, Response, NextFunction } from 'express';
import { AnnouncementsService } from './announcements.service.js';
import { createAnnouncementSchema } from '@ap/shared-validation';

export class AnnouncementsController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const body = createAnnouncementSchema.parse(req.body);
      const result = await AnnouncementsService.create(req.auth!.userId, body);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const result = await AnnouncementsService.list({ page, limit });
      res.json({
        success: true,
        data: result.items,
        meta: { pagination: result.pagination },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AnnouncementsService.getById(req.params.id as string);
      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

