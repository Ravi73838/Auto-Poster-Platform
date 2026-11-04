import { type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { type SettingKey } from '@ap/shared-constants';
import { AdminSettingsService } from './admin-settings.service.js';

const updateSettingSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
  reason: z.string().min(3).max(500),
});

const reviewChangeSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
});

export class AdminSettingsController {
  static async listGroupedSettings(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const groups = await AdminSettingsService.listGroupedSettings();
      res.json({ success: true, data: groups });
    } catch (err) {
      next(err);
    }
  }

  static async updateOrRequestSetting(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { key, value, reason } = updateSettingSchema.parse(req.body);
      const result = await AdminSettingsService.updateOrRequestSetting(
        req.auth!.userId,
        key as SettingKey,
        value,
        reason,
        req.ip,
        req.headers['user-agent'],
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async reviewChangeRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const { decision } = reviewChangeSchema.parse(req.body);
      await AdminSettingsService.reviewChangeRequest(
        req.auth!.userId,
        id,
        decision,
        req.ip,
        req.headers['user-agent'],
      );
      res.json({ success: true, message: `Setting change request ${decision.toLowerCase()}d successfully` });
    } catch (err) {
      next(err);
    }
  }

  static async listChangeRequests(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requests = await AdminSettingsService.listChangeRequests();
      res.json({ success: true, data: requests });
    } catch (err) {
      next(err);
    }
  }
}
