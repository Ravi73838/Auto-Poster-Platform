import { type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { WorkQueuesService } from './work-queues.service.js';

const assignQueueItemSchema = z.object({
  queue: z.enum(['kyc', 'campaigns', 'installations', 'daily_photos', 'disputes']),
  itemId: z.string().uuid(),
  targetAdminId: z.string().uuid().nullable(),
});

export class WorkQueuesController {
  static async getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await WorkQueuesService.getSummary(req.auth?.userId);
      res.json({ success: true, data: summary });
    } catch (err) {
      next(err);
    }
  }

  static async getMyWork(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const items = await WorkQueuesService.getMyWork(req.auth!.userId);
      res.json({ success: true, data: items });
    } catch (err) {
      next(err);
    }
  }

  static async assignQueueItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { queue, itemId, targetAdminId } = assignQueueItemSchema.parse(req.body);
      await WorkQueuesService.assignQueueItem(
        req.auth!.userId,
        queue,
        itemId,
        targetAdminId,
        req.ip,
        req.headers['user-agent'],
      );
      res.json({ success: true, data: { queue, itemId, targetAdminId } });
    } catch (err) {
      next(err);
    }
  }

  static async getTeamWorkload(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workload = await WorkQueuesService.getTeamWorkload();
      res.json({ success: true, data: workload });
    } catch (err) {
      next(err);
    }
  }
}
