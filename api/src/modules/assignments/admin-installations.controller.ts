import type { Request, Response, NextFunction } from 'express';
import { AdminInstallationsService } from './admin-installations.service.js';
import { reviewInstallationSchema } from '@ap/shared-validation';

export class AdminInstallationsController {
  static async getReviewQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const assignedToMe = req.query.assignedToMe === 'true';
      const unassigned = req.query.unassigned === 'true';

      const result = await AdminInstallationsService.getReviewQueue(req.auth!.userId, {
        assignedToMe,
        unassigned,
      });
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async claim(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AdminInstallationsService.claim(req.auth!.userId, req.params.id!);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async release(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AdminInstallationsService.release(req.auth!.userId, req.params.id!);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async decide(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = reviewInstallationSchema.parse(req.body);
      const result = await AdminInstallationsService.decide(req.auth!.userId, req.params.id!, input);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

