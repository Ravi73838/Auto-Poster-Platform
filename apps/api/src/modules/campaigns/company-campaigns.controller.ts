import type { Request, Response, NextFunction } from 'express';
import { CompanyCampaignsService } from './company-campaigns.service.js';
import {
  createCampaignDraftSchema,
  updateCampaignDraftSchema,
  campaignPricePreviewSchema,
  listCompanyCampaignsQuerySchema,
  cancelCampaignSchema,
  driverAvailabilityQuerySchema,
} from '@ap/shared-validation';

export class CompanyCampaignsController {
  static async getRules(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rules = await CompanyCampaignsService.getRules();
      res.status(200).json({ success: true, data: rules });
    } catch (err) {
      next(err);
    }
  }

  static async getAvailability(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = driverAvailabilityQuerySchema.parse({
        cityId: req.query.cityId,
        zoneIds: typeof req.query.zoneIds === 'string' ? req.query.zoneIds.split(',').filter(Boolean) : req.query.zoneIds,
        vehicleType: req.query.vehicleType,
      });

      const zoneIds = Array.isArray(query.zoneIds) ? query.zoneIds : [];
      const result = await CompanyCampaignsService.getAvailability(
        query.cityId,
        zoneIds,
        query.vehicleType,
      );

      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async pricePreview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = campaignPricePreviewSchema.parse(req.body);
      const result = await CompanyCampaignsService.calculatePricePreview(input);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async createDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createCampaignDraftSchema.parse(req.body);
      const result = await CompanyCampaignsService.createDraft(req.auth!.userId, input);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async updateDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = updateCampaignDraftSchema.parse(req.body);
      const result = await CompanyCampaignsService.updateDraft(
        req.auth!.userId,
        req.params.id!,
        input,
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async deleteDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await CompanyCampaignsService.deleteDraft(req.auth!.userId, req.params.id!);
      res.status(200).json({ success: true, data: { success: true } });
    } catch (err) {
      next(err);
    }
  }

  static async clone(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await CompanyCampaignsService.clone(req.auth!.userId, req.params.id!);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listCompanyCampaignsQuerySchema.parse(req.query);
      const result = await CompanyCampaignsService.list(req.auth!.userId, query);
      res.status(200).json({
        success: true,
        data: result.items,
        meta: {
          pagination: result.pagination,
          counts: result.counts,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await CompanyCampaignsService.getDetail(req.auth!.userId, req.params.id!);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async submit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await CompanyCampaignsService.submit(req.auth!.userId, req.params.id!);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = cancelCampaignSchema.parse(req.body);
      const result = await CompanyCampaignsService.cancel(
        req.auth!.userId,
        req.params.id!,
        input.reason,
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async reopen(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await CompanyCampaignsService.reopen(req.auth!.userId, req.params.id!);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getPaymentSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const detail = await CompanyCampaignsService.getDetail(req.auth!.userId, req.params.id!);
      res.status(200).json({
        success: true,
        data: detail.paymentSummary,
      });
    } catch (err) {
      next(err);
    }
  }
}
