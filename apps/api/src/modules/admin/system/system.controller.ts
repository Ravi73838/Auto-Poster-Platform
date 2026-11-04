import { type Request, type Response, type NextFunction } from 'express';
import { type JobRunStatus } from '@ap/shared-constants';
import { SystemService } from './system.service.js';

export class SystemController {
  static async getHealth(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const health = await SystemService.getHealth();
      res.json({ success: true, data: health });
    } catch (err) {
      next(err);
    }
  }

  static async listJobRuns(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const jobName = typeof req.query.jobName === 'string' ? req.query.jobName : undefined;
      const status = typeof req.query.status === 'string' ? (req.query.status as JobRunStatus) : undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const runs = await SystemService.listJobRuns({ jobName, status, page, limit });
      res.json({ success: true, data: runs });
    } catch (err) {
      next(err);
    }
  }

  static async retryJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const retried = await SystemService.retryJob(id);
      res.json({ success: true, data: retried, message: 'Job retry initiated successfully' });
    } catch (err) {
      next(err);
    }
  }
}
