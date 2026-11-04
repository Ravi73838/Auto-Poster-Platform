import { type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { LEGAL_DOCUMENT_TYPES, type LegalDocumentType } from '@ap/shared-constants';
import { LegalService } from './legal.service.js';
import { HelpService } from './help.service.js';

const createLegalSchema = z.object({
  type: z.nativeEnum(LEGAL_DOCUMENT_TYPES),
  language: z.string().optional().default('en'),
  title: z.string().min(1),
  bodyMarkdown: z.string().min(10),
});

const createHelpSchema = z.object({
  category: z.string().min(1),
  language: z.string().optional().default('en'),
  title: z.string().min(1),
  bodyMarkdown: z.string().min(10),
  sortOrder: z.number().int().optional(),
  published: z.boolean().optional(),
});

export class ContentController {
  // Legal Documents
  static async listLegalDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const type = req.query.type as LegalDocumentType | undefined;
      const docs = await LegalService.listDocuments(type);
      res.json({ success: true, data: docs });
    } catch (err) {
      next(err);
    }
  }

  static async getActiveLegalDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const type = req.params.type as LegalDocumentType;
      const language = (req.query.language as string) || req.language || 'en';
      const doc = await LegalService.getActiveDocument(type, language);
      res.json({ success: true, data: doc });
    } catch (err) {
      next(err);
    }
  }

  static async createLegalDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createLegalSchema.parse(req.body);
      const doc = await LegalService.createDraft(
        req.auth!.userId,
        input,
        req.ip,
        req.headers['user-agent'],
      );
      res.status(201).json({ success: true, data: doc });
    } catch (err) {
      next(err);
    }
  }

  static async publishLegalDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      await LegalService.publishDocument(
        req.auth!.userId,
        id,
        req.ip,
        req.headers['user-agent'],
      );
      res.json({ success: true, message: 'Legal document published successfully' });
    } catch (err) {
      next(err);
    }
  }

  // Help Articles
  static async listHelpArticles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const category = req.query.category as string | undefined;
      const language = req.query.language as string | undefined;
      const publishedOnly = req.query.publishedOnly === 'true';

      const articles = await HelpService.listArticles({ category, language, publishedOnly });
      res.json({ success: true, data: articles });
    } catch (err) {
      next(err);
    }
  }

  static async getHelpArticle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const article = await HelpService.getArticle(id);
      res.json({ success: true, data: article });
    } catch (err) {
      next(err);
    }
  }

  static async createHelpArticle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createHelpSchema.parse(req.body);
      const article = await HelpService.createArticle(req.auth!.userId, input);
      res.status(201).json({ success: true, data: article });
    } catch (err) {
      next(err);
    }
  }

  static async updateHelpArticle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const article = await HelpService.updateArticle(req.auth!.userId, id, req.body);
      res.json({ success: true, data: article });
    } catch (err) {
      next(err);
    }
  }

  static async deleteHelpArticle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      await HelpService.deleteArticle(id);
      res.json({ success: true, message: 'Help article deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
}
