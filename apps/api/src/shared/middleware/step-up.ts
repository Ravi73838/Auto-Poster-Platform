import { type Request, type Response, type NextFunction } from 'express';
import { ERROR_CODES, SETTING_KEYS } from '@ap/shared-constants';
import { prisma } from '../db/index.js';
import { SettingsService } from '../../modules/settings/settings.service.js';
import { AppError, UnauthorizedError } from '../errors/index.js';

export function requireStepUp() {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.auth) {
        throw new UnauthorizedError('Authentication required');
      }

      const ttlMinutes = await SettingsService.get(SETTING_KEYS.STEP_UP_TTL_MINUTES).catch(() => 15);
      const ttlMs = ttlMinutes * 60 * 1000;
      const now = Date.now();

      // Check current in-memory auth timestamp first
      if (req.auth.stepUpVerifiedAt) {
        const verifiedTime = new Date(req.auth.stepUpVerifiedAt).getTime();
        if (now - verifiedTime <= ttlMs) {
          return next();
        }
      }

      // Re-check database to ensure fresh state across tabs/requests
      const session = await prisma.session.findUnique({
        where: { id: req.auth.sessionId },
        select: { stepUpVerifiedAt: true },
      });

      if (session?.stepUpVerifiedAt) {
        const verifiedTime = new Date(session.stepUpVerifiedAt).getTime();
        if (now - verifiedTime <= ttlMs) {
          req.auth.stepUpVerifiedAt = session.stepUpVerifiedAt;
          return next();
        }
      }

      throw new AppError(
        ERROR_CODES.STEP_UP_REQUIRED,
        'Step-up authentication required for this sensitive action',
        403,
        {
          stepUpRequired: true,
          ttlMinutes,
        },
      );
    } catch (err) {
      next(err);
    }
  };
}
