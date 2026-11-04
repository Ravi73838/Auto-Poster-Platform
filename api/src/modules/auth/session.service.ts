import { type SessionDto } from '@ap/shared-types';
import { prisma } from '../../shared/db/index.js';
import { NotFoundError, ForbiddenError } from '../../shared/errors/index.js';

export class SessionService {
  /**
   * Lists all active sessions for a user, indicating the current session.
   */
  static async listSessions(
    userId: string,
    currentSessionId?: string,
  ): Promise<SessionDto[]> {
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastUsedAt: 'desc' },
    });

    return sessions.map((s) => ({
      id: s.id,
      platform: s.platform,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      appVersion: s.appVersion,
      createdAt: s.createdAt.toISOString(),
      lastUsedAt: s.lastUsedAt.toISOString(),
      isCurrent: s.id === currentSessionId,
    }));
  }

  /**
   * Revokes a specific session belonging to a user.
   */
  static async revokeSession(sessionId: string, userId: string): Promise<void> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundError('Session not found');
    }

    if (session.userId !== userId) {
      throw new ForbiddenError('You can only revoke your own sessions');
    }

    if (session.revokedAt === null) {
      await prisma.session.update({
        where: { id: sessionId },
        data: { revokedAt: new Date() },
      });
    }
  }

  /**
   * Revokes all active sessions for a user, optionally preserving a current session.
   */
  static async revokeAllSessions(
    userId: string,
    exceptSessionId?: string,
  ): Promise<number> {
    const result = await prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date() },
    });

    return result.count;
  }

  /**
   * Touches a session to update its lastUsedAt timestamp.
   */
  static async touchSession(sessionId: string): Promise<void> {
    await prisma.session.update({
      where: { id: sessionId },
      data: { lastUsedAt: new Date() },
    }).catch(() => {
      // Ignored if session does not exist
    });
  }
}

