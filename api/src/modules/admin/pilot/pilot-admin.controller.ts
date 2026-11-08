import type { Request, Response, NextFunction } from 'express';
import { PilotAdminService } from './pilot-admin.service.js';
import { InviteCodeService } from '../../pilot/invite-code.service.js';
import { WaitlistService } from '../../pilot/waitlist.service.js';
import { UnauthorizedError } from '../../../shared/errors/index.js';

export class PilotAdminController {
  static async getCommandCenter(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await PilotAdminService.getCommandCenterData();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  // --- ANOMALIES ---
  static async listAnomalies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await PilotAdminService.listAnomalies(req.query);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async resolveAnomaly(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const { status, resolutionNote } = req.body;
      const actorUserId = req.auth?.userId;

      const data = await PilotAdminService.resolveAnomaly({
        id,
        status,
        resolutionNote,
        actorUserId,
      });

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  // --- SECOND-LOOK QC ---
  static async listSecondLooks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await PilotAdminService.listSecondLooks(req.query);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async decideSecondLook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const { outcome, decisionNote } = req.body;
      const reviewerUserId = req.auth?.userId;
      if (!reviewerUserId) throw new UnauthorizedError('Authentication required');

      const data = await PilotAdminService.decideSecondLook({
        id,
        outcome,
        decisionNote,
        reviewerUserId,
      });

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  // --- INVITE CODES ---
  static async listInviteCodes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await InviteCodeService.listCodes(req.query);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async createInviteCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = req.auth?.userId;
      const data = await InviteCodeService.createCode({
        ...req.body,
        creatorUserId: actorUserId,
      });
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async createInviteBatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = req.auth?.userId;
      const data = await InviteCodeService.createBatch({
        ...req.body,
        creatorUserId: actorUserId,
      });
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async revokeInviteCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const data = await InviteCodeService.revokeCode(id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  // --- WAITLIST ---
  static async listWaitlist(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WaitlistService.list(req.query);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async inviteWaitlist(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const actorUserId = req.auth?.userId;
      const data = await WaitlistService.invite(id, actorUserId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  // --- PRINT SHOPS ---
  static async listPrintShops(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await PilotAdminService.listPrintShops(req.query);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async createPrintShop(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await PilotAdminService.createPrintShop(req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async updatePrintShop(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const data = await PilotAdminService.updatePrintShop(id, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async deletePrintShop(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const data = await PilotAdminService.deletePrintShop(id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

