import type { Request, Response, NextFunction } from 'express';
import { CompanyInstallationsService } from './company-installations.service.js';
import { reviewInstallationSchema } from '@ap/shared-validation';

export class CompanyInstallationsController {
  static async getCampaignInstallations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await CompanyInstallationsService.getCampaignInstallations(
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
      const input = reviewInstallationSchema.parse(req.body);
      const result = await CompanyInstallationsService.decide(
        req.auth!.userId,
        req.params.id!,
        input,
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

