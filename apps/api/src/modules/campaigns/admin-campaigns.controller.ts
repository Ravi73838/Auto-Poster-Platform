import type { Request, Response, NextFunction } from 'express';
import { AdminCampaignsService } from './admin-campaigns.service.js';
import {
  listAdminCampaignsQuerySchema,
  adminCampaignDecisionSchema,
  cancelCampaignSchema,
} from '@ap/shared-validation';

export class AdminCampaignsController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listAdminCampaignsQuerySchema.parse(req.query);
      const result = await AdminCampaignsService.list(query);
      res.status(200).json({
        success: true,
        data: result.items,
        meta: { pagination: result.pagination },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getReviewQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const assignedToMe = req.query.assignedToMe === 'true';
      const unassigned = req.query.unassigned === 'true';
      const result = await AdminCampaignsService.getReviewQueue(req.auth!.userId, {
        assignedToMe,
        unassigned,
      });
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async claimNext(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AdminCampaignsService.claimNext(req.auth!.userId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async claim(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AdminCampaignsService.claim(req.auth!.userId, req.params.id!);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async release(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AdminCampaignsService.release(
        req.auth!.userId,
        req.params.id!,
        req.auth!.role,
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AdminCampaignsService.getDetail(
        {
          id: req.auth!.userId,
          role: req.auth!.role,
          permissions: req.auth!.permissions ?? [],
        },
        req.params.id!,
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async decide(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = adminCampaignDecisionSchema.parse(req.body);
      const result = await AdminCampaignsService.decide(
        req.auth!.userId,
        req.params.id!,
        req.auth!.role,
        input,
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = cancelCampaignSchema.parse(req.body);
      const result = await AdminCampaignsService.forceCancel(
        req.auth!.userId,
        req.params.id!,
        input.reason,
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}
