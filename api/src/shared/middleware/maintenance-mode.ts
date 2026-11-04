import { type Request, type Response, type NextFunction } from 'express';
import { ERROR_CODES, ROLES, SETTING_KEYS } from '@ap/shared-constants';
import { SettingsService } from '../../modules/settings/settings.service.js';
import { AppError } from '../errors/index.js';

export function maintenanceModeGuard() {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const isMaintenance = await SettingsService.get(SETTING_KEYS.MAINTENANCE_MODE).catch(() => false);
      if (!isMaintenance) {
        return next();
      }

      const url = req.originalUrl || req.url;

      // Always permit health checks
      if (url.includes('/health')) {
        return next();
      }

      // Always permit admin routes and admin users
      if (url.includes('/api/v1/admin')) {
        return next();
      }

      // Allow users with active admin roles
      if (
        req.auth &&
        (req.auth.role === ROLES.SUPER_ADMIN ||
          req.auth.role === ROLES.MODERATOR ||
          req.auth.role === ROLES.FINANCE)
      ) {
        return next();
      }

      // Allow login endpoint so admins can sign in during maintenance
      if (url.includes('/api/v1/auth/login')) {
        return next();
      }

      const message = await SettingsService.get(SETTING_KEYS.MAINTENANCE_MESSAGE).catch(
        () => 'System maintenance is in progress. Please check back shortly.',
      );

      throw new AppError(
        ERROR_CODES.MAINTENANCE_MODE,
        message,
        503,
        {
          maintenance: true,
          message,
        },
      );
    } catch (err) {
      next(err);
    }
  };
}
