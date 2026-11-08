import type { Request, Response, NextFunction } from 'express';
import { LaunchService } from './launch.service.js';
import type { PilotSignOffKey } from '@ap/shared-constants';
import { UnauthorizedError } from '../../../shared/errors/index.js';

export class LaunchController {
  static async getReadiness(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await LaunchService.getLaunchReadiness();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async getSignOffs(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await LaunchService.getSignOffs();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async attestSignOff(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { key, notes } = req.body;
      const user = req.auth;
      if (!user) {
        throw new UnauthorizedError('Authentication required');
      }

      const data = await LaunchService.attestSignOff({
        key: key as PilotSignOffKey,
        userId: user.userId,
        userEmail: (req as any).user?.email || 'admin@autoposter.com',
        notes,
        ipAddress: req.ip,
      });

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async revokeSignOff(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const key = req.params.key as PilotSignOffKey;
      const user = req.auth;
      if (!user) {
        throw new UnauthorizedError('Authentication required');
      }

      const data = await LaunchService.revokeSignOff({
        key,
        userId: user.userId,
        userEmail: (req as any).user?.email || 'admin@autoposter.com',
      });

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

