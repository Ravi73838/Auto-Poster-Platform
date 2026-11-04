import { ROLES, type Role, ACTOR_TYPES } from '@ap/shared-constants';
import { prisma } from '../../../shared/db/index.js';
import { invalidatePermissionsCache } from '../../../shared/middleware/auth.js';
import { AuditService } from '../../audit/audit.service.js';
import { ForbiddenError, ValidationError } from '../../../shared/errors/index.js';

export class RolesService {
  /**
   * Retrieves all permissions and mapping of roles to granted permissions.
   */
  static async getRolesMatrix(): Promise<any> {
    const permissions = await prisma.permission.findMany({
      orderBy: { key: 'asc' },
    });

    const rolePermissions = await prisma.rolePermission.findMany({
      include: { permission: true },
    });

    const roles: Role[] = [
      ROLES.SUPER_ADMIN,
      ROLES.MODERATOR,
      ROLES.FINANCE,
      ROLES.COMPANY,
      ROLES.DRIVER,
    ];

    const matrix: Record<string, string[]> = {};
    for (const r of roles) {
      if (r === ROLES.SUPER_ADMIN) {
        matrix[r] = permissions.map((p) => p.key);
      } else {
        matrix[r] = rolePermissions
          .filter((rp) => rp.role === r)
          .map((rp) => rp.permission.key);
      }
    }

    return {
      roles,
      permissions: permissions.map((p) => ({
        id: p.id,
        key: p.key,
        description: p.description,
      })),
      matrix,
    };
  }

  /**
   * Updates granted permissions for an administrative role.
   */
  static async updateRolePermissions(
    actingAdminId: string,
    role: Role,
    permissionKeys: string[],
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    if (role === ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Super Admin permissions are immutable and cannot be restricted.');
    }

    if (!([ROLES.MODERATOR, ROLES.FINANCE] as Role[]).includes(role)) {
      throw new ValidationError('Only internal administrative roles can be managed in this matrix.');
    }

    const matchedPermissions = await prisma.permission.findMany({
      where: { key: { in: permissionKeys } },
    });

    await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { role } });

      if (matchedPermissions.length > 0) {
        await tx.rolePermission.createMany({
          data: matchedPermissions.map((p) => ({
            role,
            permissionId: p.id,
          })),
        });
      }
    });

    // Invalidate runtime permissions cache immediately
    invalidatePermissionsCache();

    await AuditService.log({
      actorId: actingAdminId,
      actorType: ACTOR_TYPES.USER,
      action: 'ROLE_PERMISSIONS_UPDATED',
      entityType: 'role',
      entityId: role,
      newValues: { permissionKeys },
      ipAddress,
      userAgent,
    });
  }
}
