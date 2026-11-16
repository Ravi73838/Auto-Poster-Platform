import { type Request, type Response, type NextFunction } from 'express';
import { presignUploadSchema, confirmUploadSchema } from '@ap/shared-validation';
import { UploadsService } from './uploads.service.js';
import { AppError } from '../../shared/errors/index.js';
import { ERROR_CODES } from '@ap/shared-constants';

export class UploadsController {
  static async presign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = req.auth ?? (req as any).user;
      if (!auth) {
        throw new AppError(ERROR_CODES.UNAUTHORIZED, 401, 'Authentication required');
      }

      const raw = {
        purpose: req.body?.purpose ?? req.body?.fileType,
        mimeType: req.body?.mimeType,
        sizeBytes: req.body?.sizeBytes ?? req.body?.fileSize,
      };

      const input = presignUploadSchema.parse(raw);
      const result = await UploadsService.presignUpload(
        auth.userId ?? auth.id,
        auth.role,
        input,
        auth.status,
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async confirm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = req.auth ?? (req as any).user;
      if (!auth) {
        throw new AppError(ERROR_CODES.UNAUTHORIZED, 401, 'Authentication required');
      }

      const input = confirmUploadSchema.parse(req.body);
      const result = await UploadsService.confirmUpload(auth.userId ?? auth.id, input);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = req.auth ?? (req as any).user;
      if (!auth) {
        throw new AppError(ERROR_CODES.UNAUTHORIZED, 401, 'Authentication required');
      }

      const fileId = req.params.fileId;
      if (!fileId || fileId === 'undefined') {
        throw new AppError(ERROR_CODES.VALIDATION_ERROR, 400, 'Invalid or missing fileId parameter');
      }

      const variant = (req.query.variant as 'original' | 'preview' | 'thumbnail') ?? 'original';
      const { FileAccessService } = await import('./uploads.service.js');
      const result = await FileAccessService.getSignedUrl(
        fileId,
        {
          id: auth.userId ?? auth.id,
          role: auth.role,
          status: auth.status,
          permissions: auth.permissions ?? [],
        },
        {
          variant,
          reason: (req.query.reason as string) ?? 'DOCUMENT_VIEW',
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        },
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}
