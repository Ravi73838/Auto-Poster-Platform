import { type Request, type Response, type NextFunction } from 'express';
import {
  createAdminSchema,
  updateAdminRoleSchema,
  updateAdminStatusSchema,
} from '@ap/shared-validation';
import { AuthService } from '../auth/auth.service.js';
import { UnauthorizedError } from '../../shared/errors/index.js';

export class AdminTeamController {
  static async createAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) throw new UnauthorizedError();
      const input = createAdminSchema.parse(req.body);
      const result = await AuthService.createAdmin(req.auth.userId, input, {
        ipAddress: req.ip ?? req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        requestId: req.id ? String(req.id) : undefined,
      });
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async listAdmins(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const admins = await AuthService.listAdmins();
      res.status(200).json({
        success: true,
        data: admins,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateAdminRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) throw new UnauthorizedError();
      const input = updateAdminRoleSchema.parse(req.body);
      const targetId = req.params['id'] as string;
      const result = await AuthService.updateAdminRole(
        req.auth.userId,
        targetId,
        input.role,
        {
          ipAddress: req.ip ?? req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
          requestId: req.id ? String(req.id) : undefined,
        },
      );
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateAdminStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) throw new UnauthorizedError();
      const input = updateAdminStatusSchema.parse(req.body);
      const targetId = req.params['id'] as string;
      const result = await AuthService.updateAdminStatus(
        req.auth.userId,
        targetId,
        input.status,
        {
          ipAddress: req.ip ?? req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
          requestId: req.id ? String(req.id) : undefined,
        },
      );
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}
