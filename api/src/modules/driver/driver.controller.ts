import { type Request, type Response, type NextFunction } from 'express';
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
  static async getOnboarding(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Unauthorized', 401);
      const data = await DriverService.getOnboardingState(req.auth.userId);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Unauthorized', 401);
      const input = driverProfileInputSchema.parse(req.body);
      await DriverService.updateProfile(req.auth.userId, input);
      res.status(200).json({ success: true, message: 'Driver profile updated' });
    } catch (err) {
      next(err);
    }
  }

  static async updateVehicle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Unauthorized', 401);
      const input = driverVehicleInputSchema.parse(req.body);
      await DriverService.updateVehicle(req.auth.userId, input);
      res.status(200).json({ success: true, message: 'Vehicle details updated' });
    } catch (err) {
      next(err);
    }
  }

  static async addDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Unauthorized', 401);
      const input = driverDocumentInputSchema.parse(req.body);
      await DriverService.addDocument(req.auth.userId, input);
      res.status(201).json({ success: true, message: 'Document added' });
    } catch (err) {
      next(err);
    }
  }

  static async deleteDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Unauthorized', 401);
      const { id } = idParamSchema.parse(req.params);
      await DriverService.deleteDocument(req.auth.userId, id);
      res.status(200).json({ success: true, message: 'Document archived' });
    } catch (err) {
      next(err);
    }
  }

  static async updatePayoutDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Unauthorized', 401);
      const input = driverPayoutInputSchema.parse(req.body);
      await DriverService.updatePayoutDetails(req.auth.userId, input, req.ip);
      res.status(200).json({ success: true, message: 'Payout details updated' });
    } catch (err) {
      next(err);
    }
  }

  static async submitConsents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Unauthorized', 401);
      const input = consentSubmissionSchema.parse(req.body);
      const ip = req.ip || '127.0.0.1';
      const userAgent = req.headers['user-agent'];
      await DriverService.submitConsents(req.auth.userId, input.consents, ip, userAgent);
      res.status(200).json({ success: true, message: 'Consents recorded' });
    } catch (err) {
      next(err);
    }
  }

  static async submitKyc(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Unauthorized', 401);
      const data = await DriverService.submitKyc(req.auth.userId);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async getKyc(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Unauthorized', 401);
      const data = await DriverService.getOnboardingState(req.auth.userId);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getHome(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Unauthorized', 401);
      const data = await DriverService.getHome(req.auth.userId);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async getCaptureRules(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await DriverService.getCaptureRules();
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}
