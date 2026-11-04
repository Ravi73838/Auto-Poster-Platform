import type { Request, Response, NextFunction } from 'express';
import { DisputesService } from './disputes.service.js';
import {
  createDriverDisputeSchema,
  createCompanyDisputeSchema,
  addDisputeMessageSchema,
  addDisputeEvidenceSchema,
  setEvidenceVisibilitySchema,
  disputeDecisionSchema,
  disputeRequestInfoSchema,
  disputeReopenRequestSchema,
} from '@ap/shared-validation';
import { type Role } from '@ap/shared-constants';

export class DisputesController {
  // --- Driver Actions ---

  static async createDriverDispute(req: Request, res: Response, next: NextFunction) {
    try {
      const body = createDriverDisputeSchema.parse(req.body);
      const result = await DisputesService.createDriverDispute(req.auth!.userId, body);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  // --- Company Actions ---

  static async createCompanyDispute(req: Request, res: Response, next: NextFunction) {
    try {
      const body = createCompanyDisputeSchema.parse(req.body);
      const result = await DisputesService.createCompanyDispute(req.auth!.userId, body);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  // --- Common Thread Actions ---

  static async addMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const body = addDisputeMessageSchema.parse(req.body);
      const result = await DisputesService.addMessage(
        req.params.id as string,
        req.auth!.userId,
        req.auth!.role as Role,
        body,
      );
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async addEvidence(req: Request, res: Response, next: NextFunction) {
    try {
      const body = addDisputeEvidenceSchema.parse(req.body);
      const result = await DisputesService.addEvidence(
        req.params.id as string,
        req.auth!.userId,
        req.auth!.role as Role,
        body,
      );
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await DisputesService.getWorkspaceDetail(
        req.params.id as string,
        req.auth!.role as Role,
        req.auth!.userId,
      );
      res.json({
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
      const status = req.query.status as string | undefined;
      const queue = req.query.queue as string | undefined;

      const result = await DisputesService.listDisputes({
        role: req.auth!.role as Role,
        userId: req.auth!.userId,
        status,
        queue,
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

  static async requestReopen(req: Request, res: Response, next: NextFunction) {
    try {
      const body = disputeReopenRequestSchema.parse(req.body);
      const result = await DisputesService.requestReopen(
        req.params.id as string,
        req.auth!.userId,
        body,
      );
      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  // --- Admin Workflow Actions ---

  static async claimNext(req: Request, res: Response, next: NextFunction) {
    try {
      const queue = req.query.queue as string | undefined;
      const result = await DisputesService.claimNext(req.auth!.userId, queue);
      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async claim(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await DisputesService.claim(req.params.id as string, req.auth!.userId);
      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async release(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await DisputesService.release(req.params.id as string, req.auth!.userId);
      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async requestInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const body = disputeRequestInfoSchema.parse(req.body);
      const result = await DisputesService.requestInfo(
        req.params.id as string,
        req.auth!.userId,
        body,
      );
      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async setEvidenceVisibility(req: Request, res: Response, next: NextFunction) {
    try {
      const body = setEvidenceVisibilitySchema.parse(req.body);
      const result = await DisputesService.setEvidenceVisibility(
        req.params.id as string,
        req.params.evidenceId as string,
        req.auth!.userId,
        body.visibleToOtherParty,
      );
      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async decisionPreview(req: Request, res: Response, next: NextFunction) {
    try {
      const body = disputeDecisionSchema.parse(req.body);
      const result = await DisputesService.decisionPreview(req.params.id as string, body);
      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async executeDecision(req: Request, res: Response, next: NextFunction) {
    try {
      const body = disputeDecisionSchema.parse(req.body);
      const result = await DisputesService.executeDecision(
        req.params.id as string,
        req.auth!.userId,
        body,
      );
      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async acceptReopen(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await DisputesService.acceptReopen(
        req.params.id as string,
        req.auth!.userId,
      );
      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

