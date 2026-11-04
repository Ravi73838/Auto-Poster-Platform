import crypto from 'node:crypto';
import { SignJWT, jwtVerify, errors } from 'jose';
import { type Role, SETTING_KEYS } from '@ap/shared-constants';
import { type Session, type User, type DevicePlatform } from '@prisma/client';
import { prisma } from '../../shared/db/index.js';
import { hashToken } from '../../shared/crypto/index.js';
import { SettingsService } from '../settings/settings.service.js';
import { AuditService } from '../audit/audit.service.js';
import {
  TokenExpiredError,
  TokenInvalidError,
  SessionRevokedError,
  AccountBlockedError,
} from '../../shared/errors/index.js';
import { env } from '../../config/env.js';
import { logger } from '../../shared/logger/index.js';

export interface AccessTokenPayload {
  userId: string;
  role: Role;
  sessionId: string;
  jti: string;
}

export class TokenService {
  private static readonly textEncoder = new TextEncoder();

  private static getSecretKey(): Uint8Array {
    return this.textEncoder.encode(env.JWT_ACCESS_SECRET);
  }

  /**
   * Signs a short-lived access JWT with HS256, kid header, and standard claims.
   */
  static async generateAccessToken(
    user: { id: string; role: Role },
    sessionId: string,
  ): Promise<string> {
    const jwt = await new SignJWT({
      role: user.role,
      sid: sessionId,
    })
      .setProtectedHeader({ alg: 'HS256', kid: 'v1' })
      .setSubject(user.id)
      .setIssuedAt()
      .setJti(crypto.randomUUID())
      .setExpirationTime(env.JWT_ACCESS_TTL)
      .sign(this.getSecretKey());

    return jwt;
  }

  /**
   * Verifies and decodes an access JWT.
   */
  static async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      const { payload } = await jwtVerify(token, this.getSecretKey(), {
        algorithms: ['HS256'],
      });

      if (!payload.sub || !payload['role'] || !payload['sid']) {
        throw new TokenInvalidError('Malformed token payload');
      }

      return {
        userId: payload.sub,
        role: payload['role'] as Role,
        sessionId: payload['sid'] as string,
        jti: (payload.jti as string) ?? '',
      };
    } catch (err) {
      if (err instanceof errors.JWTExpired) {
        throw new TokenExpiredError('Access token has expired');
      }
      if (err instanceof TokenExpiredError || err instanceof TokenInvalidError) {
        throw err;
      }
      throw new TokenInvalidError('Invalid access token');
    }
  }

  /**
   * Generates a high-entropy 256-bit cryptographically secure refresh token string.
   */
  static generateRefreshToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Creates a new session, enforcing max concurrent sessions per user.
   */
  static async createSession(params: {
    userId: string;
    platform?: DevicePlatform;
    userAgent?: string;
    ipAddress?: string;
    appVersion?: string;
  }): Promise<{ session: Session; rawRefreshToken: string; accessToken: string }> {
    const { userId, platform = 'WEB', userAgent, ipAddress, appVersion } = params;

    // Enforce max_sessions_per_user
    const maxSessions = await SettingsService.get(SETTING_KEYS.MAX_SESSIONS_PER_USER).catch(() => 5);

    const activeSessions = await prisma.session.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'asc' },
    });

    if (activeSessions.length >= maxSessions) {
      const toRevokeCount = activeSessions.length - maxSessions + 1;
      const oldestToRevoke = activeSessions.slice(0, toRevokeCount);
      const idsToRevoke = oldestToRevoke.map((s) => s.id);

      await prisma.session.updateMany({
        where: { id: { in: idsToRevoke } },
        data: { revokedAt: new Date() },
      });

      logger.info({ userId, idsToRevoke }, 'Revoked oldest session(s) due to max session limit');
    }

    const rawRefreshToken = this.generateRefreshToken();
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);

    const session = await prisma.session.create({
      data: {
        userId,
        tokenHash,
        platform,
        userAgent,
        ipAddress,
        appVersion,
        expiresAt,
        lastUsedAt: new Date(),
      },
      include: {
        user: true,
      },
    });

    const accessToken = await this.generateAccessToken(
      { id: session.user.id, role: session.user.role },
      session.id,
    );

    return { session, rawRefreshToken, accessToken };
  }

  /**
   * Rotates a refresh token with automatic reuse detection.
   * If an already-rotated token is presented, the entire session family for that user is revoked.
   */
  static async rotateRefreshToken(
    rawRefreshToken: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<{ accessToken: string; rawRefreshToken: string; session: Session; user: User }> {
    const currentHash = hashToken(rawRefreshToken);

    // 1. Check for token reuse: Was this token previously rotated?
    const reusedSession = await prisma.session.findFirst({
      where: { previousTokenHash: currentHash },
      include: { user: true },
    });

    if (reusedSession) {
      // SECURITY INCIDENT: A rotated token has been presented again!
      // Revoke the entire session family for that user
      await prisma.session.updateMany({
        where: { userId: reusedSession.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await AuditService.log({
        actorId: reusedSession.userId,
        actorType: 'SYSTEM',
        action: 'auth.token_reuse_detected',
        entityType: 'Session',
        entityId: reusedSession.id,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        newValues: {
          incident: 'REFRESH_TOKEN_REUSE',
          revokedSessionsForUser: reusedSession.userId,
        },
      });

      logger.error(
        { userId: reusedSession.userId, sessionId: reusedSession.id },
        'SECURITY ALERT: Refresh token reuse detected! All user sessions revoked.',
      );

      throw new SessionRevokedError('Token reuse detected. All active sessions have been revoked.');
    }

    // 2. Find the active session matching the current token hash
    const session = await prisma.session.findUnique({
      where: { tokenHash: currentHash },
      include: { user: true },
    });

    if (!session || session.revokedAt !== null || new Date() > session.expiresAt) {
      throw new SessionRevokedError('Session is invalid or has expired');
    }

    // 3. Verify user status
    if (session.user.deletedAt !== null || session.user.status === 'BLOCKED') {
      await prisma.session.updateMany({
        where: { userId: session.userId },
        data: { revokedAt: new Date() },
      });
      throw new AccountBlockedError('Account is blocked or deactivated');
    }

    // 4. Rotate: issue new token, store old hash as previousTokenHash
    const newRawRefreshToken = this.generateRefreshToken();
    const newTokenHash = hashToken(newRawRefreshToken);
    const now = new Date();

    const updatedSession = await prisma.session.update({
      where: { id: session.id },
      data: {
        tokenHash: newTokenHash,
        previousTokenHash: currentHash,
        lastUsedAt: now,
        ipAddress: context?.ipAddress ?? session.ipAddress,
        userAgent: context?.userAgent ?? session.userAgent,
      },
    });

    // 5. Generate new access token
    const accessToken = await this.generateAccessToken(
      { id: session.user.id, role: session.user.role },
      session.id,
    );

    return {
      accessToken,
      rawRefreshToken: newRawRefreshToken,
      session: updatedSession,
      user: session.user,
    };
  }
}

