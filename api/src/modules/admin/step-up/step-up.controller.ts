import { type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import {
  ERROR_CODES,
  OTP_PURPOSES,
  SETTING_KEYS,
  ACTOR_TYPES,
} from '@ap/shared-constants';
import { prisma } from '../../../shared/db/index.js';
import { decrypt } from '../../../shared/crypto/index.js';
import { env } from '../../../config/env.js';
import { OtpService } from '../../auth/otp.service.js';
import { PasswordService } from '../../auth/password.service.js';
import { SettingsService } from '../../settings/settings.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { AppError, NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import { stepUpVerifySchema } from '@ap/shared-validation';
import {
  maskPhone,
  maskEmail,
  maskBankAccount,
  maskPan,
  maskAadhaar,
  maskGstin,
} from '../../../shared/pii.js';

const stepUpRequestSchema = z.object({
  channel: z.enum(['SMS', 'EMAIL']).optional().default('SMS'),
});

const revealSchema = z.object({
  entityType: z.enum(['DRIVER', 'COMPANY', 'USER', 'TAX_DOCUMENT', 'VEHICLE']),
  entityId: z.string().uuid(),
  field: z.string().min(1),
});

export class StepUpController {
  /**
   * Dispatches a 2FA challenge code to the administrator's phone or email.
   */
  static async requestChallenge(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!env.AUTH_OTP_ENABLED) {
        throw new AppError(
          ERROR_CODES.OTP_DISABLED,
          'OTP authentication is disabled in this environment. Step-up requires password verification.',
          400,
        );
      }

      const { channel } = stepUpRequestSchema.parse(req.body);
      const user = await prisma.user.findUnique({
        where: { id: req.auth!.userId },
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      let target: string;
      if (channel === 'EMAIL') {
        if (!user.email) {
          throw new ValidationError('No email address registered for this administrator account');
        }
        target = user.email;
      } else {
        if (!user.mobile) {
          if (user.email) {
            target = user.email;
          } else {
            throw new ValidationError('No mobile number registered for this administrator account');
          }
        } else {
          target = user.mobile;
        }
      }

      const { expiresAt } = await OtpService.requestOtp({
        target,
        purpose: OTP_PURPOSES.ADMIN_2FA,
        ipAddress: req.ip,
        language: req.language,
      });

      res.json({
        success: true,
        data: {
          channel: target.includes('@') ? 'EMAIL' : 'SMS',
          maskedDestination: target.includes('@') ? maskEmail(target) : maskPhone(target),
          expiresAt: expiresAt.toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Verifies the 2FA code and marks the current session as step-up verified.
   */
  static async verifyChallenge(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, password } = stepUpVerifySchema.parse(req.body);
      const user = await prisma.user.findUnique({
        where: { id: req.auth!.userId },
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      if (!env.AUTH_OTP_ENABLED) {
        if (!password) {
          throw new AppError(ERROR_CODES.STEP_UP_INVALID, 'Password is required for step-up verification', 400);
        }
        if (!user.passwordHash) {
          throw new AppError(ERROR_CODES.STEP_UP_INVALID, 'User has no password configured', 400);
        }
        const isValid = await PasswordService.verify(password, user.passwordHash);
        if (!isValid) {
          throw new AppError(ERROR_CODES.STEP_UP_INVALID, 'Incorrect password for step-up verification', 400);
        }

        const now = new Date();
        await prisma.session.update({
          where: { id: req.auth!.sessionId },
          data: { stepUpVerifiedAt: now },
        });

        req.auth!.stepUpVerifiedAt = now;

        await AuditService.log({
          actorId: req.auth!.userId,
          actorType: ACTOR_TYPES.USER,
          action: 'STEP_UP_VERIFIED',
          entityType: 'Session',
          entityId: req.auth!.sessionId,
          newValues: { method: 'PASSWORD' },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        });

        const ttlMinutes = await SettingsService.get(SETTING_KEYS.STEP_UP_TTL_MINUTES).catch(() => 15);
        const validUntil = new Date(now.getTime() + ttlMinutes * 60 * 1000);

        res.json({
          success: true,
          data: {
            stepUpVerified: true,
            verifiedAt: now.toISOString(),
            validUntil: validUntil.toISOString(),
            ttlMinutes,
          },
        });
        return;
      }

      if (!code) {
        throw new AppError(ERROR_CODES.STEP_UP_INVALID, 'Verification code is required', 400);
      }

      const activeOtp = await prisma.otpRequest.findFirst({
        where: {
          mobile: { in: [user.mobile, user.email].filter(Boolean) as string[] },
          purpose: OTP_PURPOSES.ADMIN_2FA,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });

      const target = activeOtp ? activeOtp.mobile : (user.mobile || user.email);
      if (!target) {
        throw new AppError(ERROR_CODES.STEP_UP_INVALID, 'No active challenge found', 400);
      }

      const isValid = await OtpService.verifyOtp({
        target,
        purpose: OTP_PURPOSES.ADMIN_2FA,
        code,
      });

      if (!isValid) {
        throw new AppError(ERROR_CODES.STEP_UP_INVALID, 'Invalid or expired verification code', 400);
      }

      const now = new Date();
      await prisma.session.update({
        where: { id: req.auth!.sessionId },
        data: { stepUpVerifiedAt: now },
      });

      req.auth!.stepUpVerifiedAt = now;

      const ttlMinutes = await SettingsService.get(SETTING_KEYS.STEP_UP_TTL_MINUTES).catch(() => 15);
      const validUntil = new Date(now.getTime() + ttlMinutes * 60 * 1000);

      res.json({
        success: true,
        data: {
          stepUpVerified: true,
          verifiedAt: now.toISOString(),
          validUntil: validUntil.toISOString(),
          ttlMinutes,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Returns whether the current session is step-up authenticated and remaining validity.
   */
  static async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const session = await prisma.session.findUnique({
        where: { id: req.auth!.sessionId },
        select: { stepUpVerifiedAt: true },
      });

      const ttlMinutes = await SettingsService.get(SETTING_KEYS.STEP_UP_TTL_MINUTES).catch(() => 15);
      const ttlMs = ttlMinutes * 60 * 1000;
      const now = Date.now();

      let isVerified = false;
      let validUntil: string | null = null;
      let verifiedAt: string | null = null;

      if (session?.stepUpVerifiedAt) {
        const vTime = session.stepUpVerifiedAt.getTime();
        if (now - vTime <= ttlMs) {
          isVerified = true;
          verifiedAt = session.stepUpVerifiedAt.toISOString();
          validUntil = new Date(vTime + ttlMs).toISOString();
        }
      }

      res.json({
        success: true,
        data: {
          stepUpVerified: isVerified,
          verifiedAt,
          validUntil,
          ttlMinutes,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Audited PII reveal endpoint.
   */
  static async revealPii(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { entityType, entityId, field } = revealSchema.parse(req.body);
      const f = field.toLowerCase();

      let value: string | null = null;

      switch (entityType) {
        case 'USER': {
          const user = await prisma.user.findUnique({ where: { id: entityId } });
          if (!user) throw new NotFoundError('User not found');
          if (f === 'mobile' || f === 'phone') value = user.mobile ?? '';
          else if (f === 'email') value = user.email ?? '';
          else throw new ValidationError(`Field ${field} is not available for reveal`);
          break;
        }

        case 'DRIVER': {
          const driver = await prisma.driverProfile.findUnique({
            where: { id: entityId },
            include: { user: true },
          });
          if (!driver) throw new NotFoundError('Driver profile not found');
          if (f === 'mobile' || f === 'phone') value = driver.user.mobile ?? '';
          else if (f === 'email') value = driver.user.email ?? '';
          else if (f === 'bankaccountnumber' || field === 'bankAccountNumber') {
            value = driver.bankAccountNumberEncrypted ? decrypt(driver.bankAccountNumberEncrypted) : '';
          } else if (f === 'bankifsc' || field === 'bankIfsc') value = driver.bankIfsc ?? '';
          else if (f === 'bankaccountname' || field === 'bankAccountName') value = driver.bankAccountName ?? '';
          else if (f === 'upiid' || field === 'upiId') {
            value = driver.upiIdEncrypted ? decrypt(driver.upiIdEncrypted) : '';
          } else throw new ValidationError(`Field ${field} is not available for reveal`);
          break;
        }

        case 'COMPANY': {
          const company = await prisma.companyProfile.findUnique({
            where: { id: entityId },
            include: { user: true },
          });
          if (!company) throw new NotFoundError('Company profile not found');
          if (f === 'gstin') value = company.gstin ?? '';
          else if (f === 'pan') value = company.pan ?? '';
          else if (f === 'contactpersonphone' || field === 'contactPersonPhone' || f === 'mobile' || f === 'phone') value = company.contactPersonPhone ?? '';
          else if (f === 'contactpersonname' || field === 'contactPersonName') value = company.contactPersonName ?? '';
          else if (f === 'email') value = company.user.email ?? '';
          else throw new ValidationError(`Field ${field} is not available for reveal`);
          break;
        }

        case 'TAX_DOCUMENT': {
          const doc = await prisma.taxDocument.findUnique({ where: { id: entityId } });
          if (!doc) throw new NotFoundError('Tax document not found');
          if (f === 'documentnumber' || field === 'documentNumber') value = doc.documentNumber;
          else throw new ValidationError(`Field ${field} is not available for reveal`);
          break;
        }

        case 'VEHICLE': {
          const vehicle = await prisma.vehicle.findUnique({ where: { id: entityId } });
          if (!vehicle) throw new NotFoundError('Vehicle not found');
          if (f === 'registrationnumber' || field === 'registrationNumber') value = vehicle.registrationNumber;
          else if (f === 'rcnumber' || field === 'rcNumber') value = vehicle.rcNumber ?? '';
          else throw new ValidationError(`Field ${field} is not available for reveal`);
          break;
        }
      }

      // Record audit log
      await AuditService.log({
        actorId: req.auth!.userId,
        actorType: ACTOR_TYPES.USER,
        action: 'PII_REVEAL',
        entityType,
        entityId,
        newValues: { field },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        data: {
          entityType,
          entityId,
          field,
          value,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
