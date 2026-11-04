import { type Request, type Response, type NextFunction } from 'express';
import { ROLES, type Role, ACCOUNT_STATUS, SETTING_KEYS, ERROR_CODES } from '@ap/shared-constants';
import { prisma } from '../db/index.js';
import { TokenService } from '../../modules/auth/token.service.js';
import { SessionService } from '../../modules/auth/session.service.js';
import { SettingsService } from '../../modules/settings/settings.service.js';
import {
  AppError,
  UnauthorizedError,
  ForbiddenError,
  AccountBlockedError,
  AccountSuspendedError,
  AccountNotApprovedError,
} from '../errors/index.js';

// In-memory cache for role permissions: role -> { permissions: string[], expiresAt: number }
const permissionsCache = new Map<Role, { permissions: string[]; expiresAt: number }>();
const PERMISSIONS_CACHE_TTL_MS = 60_000;

export function invalidatePermissionsCache(): void {
  permissionsCache.clear();
}

export async function getPermissionsForRole(role: Role): Promise<string[]> {
  const cached = permissionsCache.get(role);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.permissions;
  }

  const rolePermissions = await prisma.rolePermission.findMany({
    where: { role },
    include: { permission: true },
  });

  const permissions = rolePermissions.map((rp) => rp.permission.key);
  permissionsCache.set(role, {
    permissions,
    expiresAt: Date.now() + PERMISSIONS_CACHE_TTL_MS,
  });

  return permissions;
}

/**
 * Authentication middleware: verifies Bearer access token, validates session,
 * loads user and permissions, touches session activity.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (req.auth) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return next();
  }

  try {
    const payload = await TokenService.verifyAccessToken(token);

    const session = await prisma.session.findUnique({
      where: { id: payload.sessionId },
      include: { user: true },
    });

    if (!session || session.revokedAt !== null || new Date() > session.expiresAt) {
      throw new UnauthorizedError('Session has been revoked or expired');
    }

    if (session.user.deletedAt !== null) {
      throw new AccountBlockedError('Account has been deactivated');
    }

    if (session.user.status === ACCOUNT_STATUS.BLOCKED) {
      // Immediately revoke all sessions for this blocked user
      await SessionService.revokeAllSessions(session.userId);
      throw new AccountBlockedError('Account has been blocked');
    }

    const isAdminRole = (
      [ROLES.SUPER_ADMIN, ROLES.MODERATOR, ROLES.FINANCE] as Role[]
    ).includes(session.user.role);

    if (isAdminRole) {
      const idleTimeoutMinutes = await SettingsService.get(
        SETTING_KEYS.ADMIN_IDLE_TIMEOUT_MINUTES,
      ).catch(() => 30);

      const idleDurationMs = Date.now() - session.lastUsedAt.getTime();
      if (idleDurationMs > idleTimeoutMinutes * 60 * 1000) {
        await prisma.session.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });
        throw new AppError(
          ERROR_CODES.SESSION_EXPIRED_IDLE,
          'Your session has expired due to inactivity. Please log in again.',
          401,
        );
      }
    }

    const permissions =
      session.user.role === ROLES.SUPER_ADMIN
        ? ['*'] // Super admin has all permissions
        : await getPermissionsForRole(session.user.role);

    req.auth = {
      userId: session.user.id,
      role: session.user.role,
      status: session.user.status,
      sessionId: session.id,
      permissions,
      stepUpVerifiedAt: session.stepUpVerifiedAt,
    };

    // Touch session activity asynchronously
    SessionService.touchSession(session.id).catch(() => {});

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Guard ensuring request is authenticated. Supports both requireAuth() and requireAuth.
 */
export function requireAuth(req?: Request, res?: Response, next?: NextFunction): any {
  const handler = (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      return next(new UnauthorizedError('Authentication required'));
    }
    next();
  };

  if (req && next) {
    return handler(req, res!, next);
  }
  return handler;
}

/**
 * Guard restricting access to specific roles.
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      return next(new UnauthorizedError('Authentication required'));
    }
    if (!roles.includes(req.auth.role)) {
      return next(new ForbiddenError('Access forbidden for this role'));
    }
    next();
  };
}

/**
 * Guard restricting access to specific permission key (SUPER_ADMIN always permitted).
 */
export function requirePermission(...permissionKeys: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      return next(new UnauthorizedError('Authentication required'));
    }
    if (req.auth.role === ROLES.SUPER_ADMIN) {
      return next();
    }
    const hasPermission = permissionKeys.some((p) => req.auth!.permissions.includes(p));
    if (!hasPermission) {
      return next(new ForbiddenError(`Missing required permission: ${permissionKeys.join(' or ')}`));
    }
    next();
  };
}

/**
 * Guard ensuring account is APPROVED. Supports both requireApproved() and requireApproved.
 */
export function requireApproved(req?: Request, res?: Response, next?: NextFunction): any {
  const handler = (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      return next(new UnauthorizedError('Authentication required'));
    }
    if (req.auth.status !== ACCOUNT_STATUS.APPROVED) {
      return next(
        new AccountNotApprovedError(
          'Your account is pending verification or approval before this action can be performed',
        ),
      );
    }
    next();
  };

  if (req && next) {
    return handler(req, res!, next);
  }
  return handler;
}

/**
 * Guard restricting suspended accounts from write operations (POST, PUT, PATCH, DELETE).
 * Allows GET, HEAD, OPTIONS, logout, and preference updates.
 */
export function blockSuspendedWrites() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth || req.auth.status !== ACCOUNT_STATUS.SUSPENDED) {
      return next();
    }

    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) {
      return next();
    }

    // Allow logout and preferences update even if suspended
    const allowedPaths = ['/api/v1/auth/logout', '/api/v1/auth/logout-all', '/api/v1/auth/me/preferences'];
    if (allowedPaths.some((p) => req.originalUrl.startsWith(p))) {
      return next();
    }

    next(
      new AccountSuspendedError(
        'Account is suspended. Modifying resources is not permitted.',
      ),
    );
  };
}

