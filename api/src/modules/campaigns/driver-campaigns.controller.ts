import type { Request, Response, NextFunction } from 'express';
import { DriverCampaignsService } from './driver-campaigns.service.js';
import { listDriverCampaignsQuerySchema } from '@ap/shared-validation';

export class DriverCampaignsController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listDriverCampaignsQuerySchema.parse(req.query);
      const result = await DriverCampaignsService.list(req.auth!.userId, query);
      res.status(200).json({
        success: true,
        data: result.items,
        meta: {
          isBanned: result.isBanned ?? false,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await DriverCampaignsService.getDetail(
        req.auth!.userId,
        req.params.id!,
      );
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}
