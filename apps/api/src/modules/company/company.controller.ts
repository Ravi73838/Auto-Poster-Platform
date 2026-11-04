import { type Request, type Response } from 'express';
import {
  companyProfileInputSchema,
  companyDocumentInputSchema,
  consentSubmissionSchema,
  idParamSchema,
} from '@ap/shared-validation';
import { CompanyService } from './company.service.js';
import { AppError } from '../../shared/errors/index.js';
import { ERROR_CODES } from '@ap/shared-constants';

export class CompanyController {
  static async getOnboarding(req: Request, res: Response): Promise<void> {
    if (!req.auth) throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Unauthorized', 401);
    const data = await CompanyService.getOnboardingState(req.auth.userId);
    res.status(200).json({ success: true, data });
  }

  static async updateProfile(req: Request, res: Response): Promise<void> {
    if (!req.auth) throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Unauthorized', 401);
    const input = companyProfileInputSchema.parse(req.body);
    await CompanyService.updateProfile(req.auth.userId, input);
    res.status(200).json({ success: true, message: 'Company profile updated' });
  }

  static async addDocument(req: Request, res: Response): Promise<void> {
    if (!req.auth) throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Unauthorized', 401);
    const input = companyDocumentInputSchema.parse(req.body);
    await CompanyService.addDocument(req.auth.userId, input);
    res.status(201).json({ success: true, message: 'Document attached' });
  }

  static async deleteDocument(req: Request, res: Response): Promise<void> {
    if (!req.auth) throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Unauthorized', 401);
    const { id } = idParamSchema.parse(req.params);
    await CompanyService.deleteDocument(req.auth.userId, id);
    res.status(200).json({ success: true, message: 'Document archived' });
  }

  static async submitConsents(req: Request, res: Response): Promise<void> {
    if (!req.auth) throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Unauthorized', 401);
    const input = consentSubmissionSchema.parse(req.body);
    const ip = req.ip || '127.0.0.1';
    const userAgent = req.headers['user-agent'];
    await CompanyService.submitConsents(req.auth.userId, input.consents, ip, userAgent);
    res.status(200).json({ success: true, message: 'Consents recorded' });
  }

  static async submitKyc(req: Request, res: Response): Promise<void> {
    if (!req.auth) throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Unauthorized', 401);
    const data = await CompanyService.submitKyc(req.auth.userId);
    res.status(200).json({ success: true, data });
  }

  static async getKyc(req: Request, res: Response): Promise<void> {
    if (!req.auth) throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Unauthorized', 401);
    const data = await CompanyService.getOnboardingState(req.auth.userId);
    res.status(200).json({
      success: true,
      data: {
        status: data.status,
        canSubmit: data.canSubmit,
        latestKyc: data.latestKyc,
      },
    });
  }
}
