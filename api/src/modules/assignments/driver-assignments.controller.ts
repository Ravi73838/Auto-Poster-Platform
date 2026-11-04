import type { Request, Response, NextFunction } from 'express';
import { AssignmentsService } from './assignments.service.js';
import {
  campaignSelectSchema,
  withdrawAssignmentSchema,
  submitInstallationPhotoSchema,
  listAssignmentsQuerySchema,
} from '@ap/shared-validation';

export class DriverAssignmentsController {
  static async selectCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const headerKey = req.header('idempotency-key') || req.header('Idempotency-Key');
      const parsedBody = campaignSelectSchema.parse(req.body || {});
      const idempotencyKey = headerKey || parsedBody.idempotencyKey;

      const result = await AssignmentsService.selectCampaign(
        req.auth!.userId,
        req.params.id!,
        { idempotencyKey },
      );
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listAssignmentsQuerySchema.parse(req.query);
      const result = await AssignmentsService.listDriverAssignments(req.auth!.userId, query);
      res.status(200).json({ success: true, data: result.items });
    } catch (err) {
      next(err);
    }
  }

  static async getDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AssignmentsService.getDriverAssignmentDetail(
        req.auth!.userId,
        req.params.id!,
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async startInstalling(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AssignmentsService.startInstalling(
        req.auth!.userId,
        req.params.id!,
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async withdraw(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = withdrawAssignmentSchema.parse(req.body || {});
      const result = await AssignmentsService.withdraw(
        req.auth!.userId,
        req.params.id!,
        input.reason,
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getPosterDownload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AssignmentsService.getPosterDownloadUrl(
        req.auth!.userId,
        req.params.id!,
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getPrintGuide(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const detail = await AssignmentsService.getDriverAssignmentDetail(
        req.auth!.userId,
        req.params.id!,
      );
      res.status(200).json({ success: true, data: detail.printGuide });
    } catch (err) {
      next(err);
    }
  }

  static async submitInstallation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = submitInstallationPhotoSchema.parse(req.body);
      const result = await AssignmentsService.submitInstallationPhoto(
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

