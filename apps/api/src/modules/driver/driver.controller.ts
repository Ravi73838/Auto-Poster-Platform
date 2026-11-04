import { type Request, type Response } from 'express';
import {
  driverProfileInputSchema,
  driverVehicleInputSchema,
  driverDocumentInputSchema,
  driverPayoutInputSchema,
  consentSubmissionSchema,
  idParamSchema,
} from '@ap/shared-validation';
import { DriverService } from './driver.service.js';
import { AppError } from '../../shared/errors/index.js';
import { ERROR_CODES } from '@ap/shared-constants';

export class DriverController {
  static async getOnboarding(req: Request, res: Response): Promise<void> {
    if (!req.auth) throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Unauthorized', 401);
    const data = await DriverService.getOnboardingState(req.auth.userId);
    res.status(200).json({ success: true, data });
  }

  static async updateProfile(req: Request, res: Response): Promise<void> {
    if (!req.auth) throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Unauthorized', 401);
    const input = driverProfileInputSchema.parse(req.body);
    await DriverService.updateProfile(req.auth.userId, input);
    res.status(200).json({ success: true, message: 'Driver profile updated' });
  }

  static async updateVehicle(req: Request, res: Response): Promise<void> {
    if (!req.auth) throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Unauthorized', 401);
    const input = driverVehicleInputSchema.parse(req.body);
    await DriverService.updateVehicle(req.auth.userId, input);
    res.status(200).json({ success: true, message: 'Vehicle details updated' });
  }

  static async addDocument(req: Request, res: Response): Promise<void> {
    if (!req.auth) throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Unauthorized', 401);
    const input = driverDocumentInputSchema.parse(req.body);
    await DriverService.addDocument(req.auth.userId, input);
    res.status(201).json({ success: true, message: 'Document added' });
  }

  static async deleteDocument(req: Request, res: Response): Promise<void> {
    if (!req.auth) throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Unauthorized', 401);
    const { id } = idParamSchema.parse(req.params);
    await DriverService.deleteDocument(req.auth.userId, id);
    res.status(200).json({ success: true, message: 'Document archived' });
  }

  static async updatePayoutDetails(req: Request, res: Response): Promise<void> {
    if (!req.auth) throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Unauthorized', 401);
    const input = driverPayoutInputSchema.parse(req.body);
    await DriverService.updatePayoutDetails(req.auth.userId, input, req.ip);
    res.status(200).json({ success: true, message: 'Payout details updated' });
  }

  static async submitConsents(req: Request, res: Response): Promise<void> {
    if (!req.auth) throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Unauthorized', 401);
    const input = consentSubmissionSchema.parse(req.body);
    const ip = req.ip || '127.0.0.1';
    const userAgent = req.headers['user-agent'];
    await DriverService.submitConsents(req.auth.userId, input.consents, ip, userAgent);
    res.status(200).json({ success: true, message: 'Consents recorded' });
  }

  static async submitKyc(req: Request, res: Response): Promise<void> {
    if (!req.auth) throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Unauthorized', 401);
    const data = await DriverService.submitKyc(req.auth.userId);
    res.status(200).json({ success: true, data });
  }

  static async getKyc(req: Request, res: Response): Promise<void> {
    if (!req.auth) throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Unauthorized', 401);
    const data = await DriverService.getOnboardingState(req.auth.userId);
    res.status(200).json({
      success: true,
      data,
    });
  }
}
