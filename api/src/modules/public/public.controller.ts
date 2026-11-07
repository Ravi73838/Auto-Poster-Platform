import type { Request, Response, NextFunction } from 'express';
import { SettingsService } from '../settings/settings.service.js';
import { SETTING_KEYS } from '@ap/shared-constants';
import type { PublicAppConfigDto } from '@ap/shared-types';
import { env } from '../../config/env.js';

export class PublicController {
  static async getAppConfig(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const minVersion = (await SettingsService.get(SETTING_KEYS.MOBILE_MIN_VERSION).catch(() => '0.1.0')) as string;
      const latestVersion = (await SettingsService.get(SETTING_KEYS.MOBILE_LATEST_VERSION).catch(() => '0.1.0')) as string;
      const maintenance = (await SettingsService.get(SETTING_KEYS.MAINTENANCE_MODE).catch(() => false)) as boolean;
      const maintenanceMessage = (await SettingsService.get(SETTING_KEYS.MAINTENANCE_MESSAGE).catch(() => null)) as string | null;

      const data: PublicAppConfigDto = {
        minVersion: minVersion || '0.1.0',
        latestVersion: latestVersion || '0.1.0',
        maintenance: Boolean(maintenance),
        maintenanceMessage: maintenanceMessage || null,
        environment: env.NODE_ENV || 'development',
      };

      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async getEnvironment(_req: Request, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      data: {
        environment: env.NODE_ENV || 'development',
        dbEnvironment: env.DB_ENVIRONMENT || 'development',
      },
    });
  }
}

