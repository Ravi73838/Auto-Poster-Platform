import type { Request, Response, NextFunction } from 'express';
import { NotificationsService } from './notifications.service.js';
import {
  listNotificationsQuerySchema,
  updateNotificationPreferencesSchema,
  updateNotificationSettingsSchema,
  registerDeviceTokenSchema,
} from '@ap/shared-validation';
import { AppError } from '../../shared/errors/app-error.js';
import { ERROR_CODES } from '@ap/shared-constants';

export class NotificationsController {
  // --- In-App Notifications ---

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = listNotificationsQuerySchema.parse(req.query);
      const result = await NotificationsService.list(req.auth!.userId, query);
      res.json({
        success: true,
        data: result.items,
        meta: { pagination: result.pagination },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getUnreadCount(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await NotificationsService.getUnreadCount(req.auth!.userId);
      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async markRead(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;
      if (!id) {
        throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'Notification ID is required');
      }
      const result = await NotificationsService.markAsRead(req.auth!.userId, id);
      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async markAllRead(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await NotificationsService.markAllAsRead(req.auth!.userId);
      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  // --- Preferences & Settings ---

  static async getPreferences(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await NotificationsService.getPreferences(req.auth!.userId);
      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updatePreferences(req: Request, res: Response, next: NextFunction) {
    try {
      const body = updateNotificationPreferencesSchema.parse(req.body);
      const result = await NotificationsService.updatePreferences(req.auth!.userId, body.preferences);
      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await NotificationsService.getSettings(req.auth!.userId);
      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const body = updateNotificationSettingsSchema.parse(req.body);
      const result = await NotificationsService.updateSettings(req.auth!.userId, body);
      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  // --- Devices ---

  static async registerDevice(req: Request, res: Response, next: NextFunction) {
    try {
      const body = registerDeviceTokenSchema.parse(req.body);
      const result = await NotificationsService.registerDevice({
        userId: req.auth!.userId,
        token: body.token,
        platform: body.platform,
        provider: body.provider,
        appVersion: body.appVersion,
      });
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async unregisterDevice(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.params.token;
      if (!token) {
        throw new AppError(ERROR_CODES.VALIDATION_ERROR, 400, 'Token is required');
      }
      await NotificationsService.unregisterDevice(req.auth!.userId, token);
      res.json({
        success: true,
        data: { unregistered: true },
      });
    } catch (err) {
      next(err);
    }
  }

  // --- Admin Stats ---

  static async getStats(_req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await NotificationsService.getStats();
      res.json({
        success: true,
        data: stats,
      });
    } catch (err) {
      next(err);
    }
  }
}
