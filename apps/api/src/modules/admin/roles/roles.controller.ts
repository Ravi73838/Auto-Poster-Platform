import { type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { ROLES, type Role } from '@ap/shared-constants';
import { RolesService } from './roles.service.js';

const updateRoleMatrixSchema = z.object({
  role: z.nativeEnum(ROLES),
  permissionKeys: z.array(z.string()),
});

export class RolesController {
  static async getRolesMatrix(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await RolesService.getRolesMatrix();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async updateRolePermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { role, permissionKeys } = updateRoleMatrixSchema.parse(req.body);
      await RolesService.updateRolePermissions(
        req.auth!.userId,
        role as Role,
        permissionKeys,
        req.ip,
        req.headers['user-agent'],
      );
      res.json({ success: true, message: `Permissions for role ${role} updated successfully` });
    } catch (err) {
      next(err);
    }
  }
}
