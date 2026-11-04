import { type Request, type Response, type NextFunction } from 'express';
import { Entity360Service } from './entity-360.service.js';

export class Entity360Controller {
  static async listDrivers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 25;
      const q = typeof req.query.q === 'string' ? req.query.q : undefined;
      const kycStatus = typeof req.query.kycStatus === 'string' ? req.query.kycStatus : undefined;
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;

      const result = await Entity360Service.listDrivers({ page, limit, q, kycStatus, status });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async listCompanies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 25;
      const q = typeof req.query.q === 'string' ? req.query.q : undefined;
      const isVerified = req.query.isVerified !== undefined ? req.query.isVerified === 'true' : undefined;
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;

      const result = await Entity360Service.listCompanies({ page, limit, q, isVerified, status });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getDriverOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const data = await Entity360Service.getDriverOverview(id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async getCompanyOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const data = await Entity360Service.getCompanyOverview(id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async listAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entityType = typeof req.query.entityType === 'string' ? req.query.entityType : undefined;
      const entityId = typeof req.query.entityId === 'string' ? req.query.entityId : undefined;
      const actorId = typeof req.query.actorId === 'string' ? req.query.actorId : undefined;
      const action = typeof req.query.action === 'string' ? req.query.action : undefined;
      const from = typeof req.query.from === 'string' ? req.query.from : undefined;
      const to = typeof req.query.to === 'string' ? req.query.to : undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const result = await Entity360Service.listAuditLogs({
        entityType,
        entityId,
        actorId,
        action,
        from,
        to,
        page,
        limit,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}
