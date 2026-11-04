import { type Request, type Response, type NextFunction } from 'express';
import { AdminSearchService } from './admin-search.service.js';

export class AdminSearchController {
  static async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q : '';
      const data = await AdminSearchService.search(q);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}
