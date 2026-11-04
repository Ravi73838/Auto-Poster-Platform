import { type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { SavedViewsService } from './saved-views.service.js';

const createSavedViewSchema = z.object({
  pageKey: z.string().min(1),
  name: z.string().min(1).max(100),
  filters: z.record(z.unknown()),
  isDefault: z.boolean().optional(),
});

const updateSavedViewSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  filters: z.record(z.unknown()).optional(),
  isDefault: z.boolean().optional(),
});

export class SavedViewsController {
  static async listSavedViews(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const pageKey = (req.query.pageKey as string) || '';
      const views = await SavedViewsService.listSavedViews(req.auth!.userId, pageKey);
      res.json({ success: true, data: views });
    } catch (err) {
      next(err);
    }
  }

  static async createSavedView(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createSavedViewSchema.parse(req.body);
      const view = await SavedViewsService.createSavedView(req.auth!.userId, input);
      res.status(201).json({ success: true, data: view });
    } catch (err) {
      next(err);
    }
  }

  static async updateSavedView(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const input = updateSavedViewSchema.parse(req.body);
      const view = await SavedViewsService.updateSavedView(req.auth!.userId, id, input);
      res.json({ success: true, data: view });
    } catch (err) {
      next(err);
    }
  }

  static async deleteSavedView(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      await SavedViewsService.deleteSavedView(req.auth!.userId, id);
      res.json({ success: true, message: 'Saved view deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
}
