import { type Request, type Response, type NextFunction } from 'express';
import { AnalyticsService } from './analytics.service.js';

export class AnalyticsController {
  static async getOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const from = typeof req.query.from === 'string' ? req.query.from : undefined;
      const to = typeof req.query.to === 'string' ? req.query.to : undefined;
      const cityId = typeof req.query.cityId === 'string' ? req.query.cityId : undefined;

      const data = await AnalyticsService.getOverview({
        from,
        to,
        cityId,
        userRole: req.auth?.role,
      });

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async triggerRollup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const targetDate = typeof req.body.date === 'string' ? new Date(req.body.date) : new Date();
      await AnalyticsService.computeRollupForDate(targetDate);
      res.json({ success: true, message: 'Rollup computed successfully' });
    } catch (err) {
      next(err);
    }
  }
}
