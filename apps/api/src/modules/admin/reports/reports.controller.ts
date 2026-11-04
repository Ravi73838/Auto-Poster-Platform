import { type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { ReportsService } from './reports.service.js';

const requestExportSchema = z.object({
  reportKey: z.string().min(1),
  filters: z.record(z.unknown()).optional(),
});

export class ReportsController {
  static async requestExport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { reportKey, filters } = requestExportSchema.parse(req.body);
      const result = await ReportsService.requestExport({
        requestedById: req.auth!.userId,
        reportKey,
        filters,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async listExports(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const exportsList = await ReportsService.listExports(req.auth!.userId);
      res.json({ success: true, data: exportsList });
    } catch (err) {
      next(err);
    }
  }

  static async downloadExport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const { filePath, filename } = await ReportsService.getExportFileForDownload(id);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.sendFile(filePath);
    } catch (err) {
      next(err);
    }
  }
}
