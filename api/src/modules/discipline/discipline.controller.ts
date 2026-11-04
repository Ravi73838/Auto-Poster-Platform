import type { Request, Response, NextFunction } from 'express';
import { StrikeService } from './strike.service.js';
import { TerminationService } from './termination.service.js';
import { ReinstatementService } from './reinstatement.service.js';
import {
  issueStrikeSchema,
  revokeStrikeSchema,
  liftBanSchema,
  terminateAssignmentSchema,
  reinstateAssignmentSchema,
} from '@ap/shared-validation';
import { STRIKE_SOURCE } from '@ap/shared-constants';

export class DisciplineController {
  // --- Admin Endpoints ---

  static async issueStrike(req: Request, res: Response, next: NextFunction) {
    try {
      const body = issueStrikeSchema.parse(req.body);
      const strike = await StrikeService.issue({
        driverId: body.driverId,
        assignmentId: body.assignmentId,
        reason: body.reason as any,
        source: STRIKE_SOURCE.ADMIN_MANUAL,
        notes: body.note,
        photoId: body.photoId,
        dayDate: body.dayDate ? new Date(`${body.dayDate}T00:00:00.000Z`) : undefined,
        issuedByUserId: req.auth!.userId,
      });

      res.status(201).json({
        success: true,
        data: strike,
      });
    } catch (err) {
      next(err);
    }
  }

  static async revokeStrike(req: Request, res: Response, next: NextFunction) {
    try {
      const body = revokeStrikeSchema.parse(req.body);
      const strike = await StrikeService.revoke(req.params.id as string, {
        revokedBy: req.auth!.userId,
        reason: body.reason,
      });

      res.json({
        success: true,
        data: strike,
      });
    } catch (err) {
      next(err);
    }
  }

  static async listStrikes(req: Request, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const driverId = req.query.driverId as string | undefined;
      const status = req.query.status as string | undefined;

      const result = await StrikeService.listStrikes({
        driverId,
        status,
        page,
        limit,
      });

      res.json({
        success: true,
        data: result.items,
        meta: { pagination: result.pagination },
      });
    } catch (err) {
      next(err);
    }
  }

  static async liftBan(req: Request, res: Response, next: NextFunction) {
    try {
      const body = liftBanSchema.parse(req.body);
      const ban = await StrikeService.liftBan(req.params.id as string, {
        liftedBy: req.auth!.userId,
        reason: body.reason,
      });

      res.json({
        success: true,
        data: ban,
      });
    } catch (err) {
      next(err);
    }
  }

  static async listBans(req: Request, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const driverId = req.query.driverId as string | undefined;

      const result = await StrikeService.listBans({
        driverId,
        page,
        limit,
      });

      res.json({
        success: true,
        data: result.items,
        meta: { pagination: result.pagination },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getDriverDisciplineAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await StrikeService.getDriverDiscipline(req.params.driverId as string);
      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async terminateAssignment(req: Request, res: Response, next: NextFunction) {
    try {
      const body = terminateAssignmentSchema.parse(req.body);
      const assignment = await TerminationService.terminate(req.params.id as string, {
        reason: body.reason,
        terminatedById: req.auth!.userId,
        notes: body.note,
      });

      res.json({
        success: true,
        data: assignment,
      });
    } catch (err) {
      next(err);
    }
  }

  static async reinstateAssignment(req: Request, res: Response, next: NextFunction) {
    try {
      const body = reinstateAssignmentSchema.parse(req.body);
      const assignment = await ReinstatementService.reinstate(req.params.id as string, {
        reinstatedBy: req.auth!.userId,
        reason: body.note,
        notes: body.note,
      });

      res.json({
        success: true,
        data: assignment,
      });
    } catch (err) {
      next(err);
    }
  }

  // --- Driver Portal Endpoints ---

  static async getDriverDisciplineMe(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await StrikeService.getDriverDiscipline(req.auth!.userId);
      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getDriverDisciplineRules(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json({
        success: true,
        data: {
          strikeLimit: 3,
          strikeValidityDays: 90,
          banDurationDays: 90,
          graceDays: 3,
          posterFixHours: 48,
          appealPeriodDays: 7,
          rules: [
            {
              code: 'FAKE_OR_OLD_PHOTO',
              title: 'Fake or Recycled Photo Proof',
              description: 'Submitting recycled, edited, or unverified photo triggers an immediate strike.',
            },
            {
              code: 'POSTER_REMOVED_OR_DAMAGED',
              title: 'Poster Removed or Damaged',
              description: 'Removing poster or failing to fix damaged poster within 48 hours of notice triggers a strike.',
            },
            {
              code: 'TOO_MANY_MISSED_DAYS',
              title: 'Excessive Missed Days',
              description: 'Missing more than grace days repeatedly may lead to assignment cancellation and a strike.',
            },
            {
              code: 'THREE_STRIKES_BAN',
              title: '3-Strike Rule',
              description: 'Accumulating 3 active strikes results in immediate removal from active campaigns and a 90-day platform ban.',
            },
          ],
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
