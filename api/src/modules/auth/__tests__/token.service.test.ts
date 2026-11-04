import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../../shared/db/index.js';
import { TokenService } from '../token.service.js';
import { ROLES, ACCOUNT_STATUS } from '@ap/shared-constants';
import {
  TokenInvalidError,
  SessionRevokedError,
} from '../../../shared/errors/index.js';
import { hashToken } from '../../../shared/crypto/index.js';
import { disconnectRedis } from '../../../shared/redis/index.js';

describe('TokenService Unit & Rotation Tests', () => {
  let testUserId: string;

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE "sessions", "users" CASCADE;
    `);

    // Create a test user
    const user = await prisma.user.create({
      data: {
        role: ROLES.COMPANY,
        status: ACCOUNT_STATUS.APPROVED,
        mobile: '+919876543200',
        email: 'token-test@example.com',
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    await disconnectRedis();
  });

  it('signs and verifies access JWT with kid and claims', async () => {
    const token = await TokenService.generateAccessToken(
      { id: testUserId, role: ROLES.COMPANY },
      'session-123',
    );

    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    const payload = await TokenService.verifyAccessToken(token);
    expect(payload.userId).toBe(testUserId);
    expect(payload.role).toBe(ROLES.COMPANY);
    expect(payload.sessionId).toBe('session-123');
  });

  it('rejects tampered or forged JWT tokens', async () => {
    const validToken = await TokenService.generateAccessToken(
      { id: testUserId, role: ROLES.COMPANY },
      'session-123',
    );

    const parts = validToken.split('.');
    const tampered = `${parts[0]}.${parts[1]}.invalidsignaturehere`;

    await expect(TokenService.verifyAccessToken(tampered)).rejects.toThrow(
      TokenInvalidError,
    );
  });

  it('creates sessions and rotates refresh tokens cleanly', async () => {
    const { accessToken, rawRefreshToken, session } = await TokenService.createSession({
      userId: testUserId,
      platform: 'WEB',
    });

    expect(session.userId).toBe(testUserId);
    expect(session.revokedAt).toBeNull();
    expect(rawRefreshToken).toBeDefined();
    expect(accessToken).toBeDefined();

    // Rotate refresh token
    const rotated = await TokenService.rotateRefreshToken(rawRefreshToken);
    expect(rotated.accessToken).toBeDefined();
    expect(rotated.rawRefreshToken).toBeDefined();
    expect(rotated.rawRefreshToken).not.toBe(rawRefreshToken);

    // Old token should now be recorded as previousTokenHash
    const updatedSession = await prisma.session.findUnique({
      where: { id: session.id },
    });
    expect(updatedSession?.previousTokenHash).toBe(hashToken(rawRefreshToken));
  });

  it('detects refresh token reuse and revokes ALL user sessions', async () => {
    // 1. Create a session
    const { rawRefreshToken: token1 } = await TokenService.createSession({
      userId: testUserId,
      platform: 'WEB',
    });

    // 2. Legitimate rotation: token1 -> token2
    const rotated = await TokenService.rotateRefreshToken(token1);
    const token2 = rotated.rawRefreshToken;

    // 3. Attacker attempts to replay token1 (reuse attack!)
    await expect(TokenService.rotateRefreshToken(token1)).rejects.toThrow(
      SessionRevokedError,
    );

    // 4. Invariant: entire session family for that user must now be revoked
    const userSessions = await prisma.session.findMany({
      where: { userId: testUserId },
    });

    expect(userSessions.length).toBeGreaterThan(0);
    for (const s of userSessions) {
      expect(s.revokedAt).not.toBeNull();
    }

    // 5. Even legitimate token2 should now be revoked and rejected
    await expect(TokenService.rotateRefreshToken(token2)).rejects.toThrow(
      SessionRevokedError,
    );
  });
});
