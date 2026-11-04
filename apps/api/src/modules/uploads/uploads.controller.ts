import { type Request, type Response } from 'express';
import { presignUploadSchema, confirmUploadSchema } from '@ap/shared-validation';
import { UploadsService } from './uploads.service.js';
import { AppError } from '../../shared/errors/index.js';
import { ERROR_CODES } from '@ap/shared-constants';

export class UploadsController {
  static async presign(req: Request, res: Response): Promise<void> {
    const auth = req.auth ?? (req as any).user;
    if (!auth) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 401, 'Authentication required');
    }

    const input = presignUploadSchema.parse(req.body);
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
  }

  static async confirm(req: Request, res: Response): Promise<void> {
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
  }

  static async getUrl(req: Request, res: Response): Promise<void> {
    const auth = req.auth ?? (req as any).user;
    if (!auth) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 401, 'Authentication required');
    }

    const variant = (req.query.variant as 'original' | 'preview' | 'thumbnail') ?? 'original';
    const { FileAccessService } = await import('./uploads.service.js');
    const result = await FileAccessService.getSignedUrl(
      req.params.fileId!,
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
  }
}


