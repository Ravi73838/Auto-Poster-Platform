import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { prisma } from '../../../shared/db/index.js';
import { createApp } from '../../../app.js';
import { ROLES, ACCOUNT_STATUS, SETTING_KEYS } from '@ap/shared-constants';
import { disconnectRedis, redisClient } from '../../../shared/redis/index.js';
import { PasswordService } from '../password.service.js';
import { TokenService } from '../token.service.js';

describe('Phase 3: Auth & Roles Integration Test Suite (autoposter_test)', () => {
  const app = createApp();

  let seededAdminId: string;
  let seededAdminPass = 'Admin@123456';
  let adminAccessToken: string;
  let companyAccessToken: string;
  let driverAccessToken: string;
  const companyEmail = 'partner@company.com';
  const companyMobile = '+919876543222';
  const companyPass = 'StrongPass123';

  beforeAll(async () => {
    // Flush Redis to reset rate limits
    await redisClient.flushdb();

    // Truncate test tables in cascade
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "sessions",
        "otp_requests",
        "audit_logs",
        "company_profiles",
        "driver_profiles",
        "users",
        "settings"
      CASCADE;
    `);

    // Seed default settings
    await prisma.setting.createMany({
      data: [
        { key: SETTING_KEYS.OTP_LENGTH, value: 6, description: 'OTP length' },
        { key: SETTING_KEYS.OTP_TTL_SECONDS, value: 300, description: 'OTP TTL' },
        { key: SETTING_KEYS.OTP_MAX_ATTEMPTS, value: 5, description: 'OTP max attempts' },
        { key: SETTING_KEYS.OTP_RESEND_COOLDOWN_SECONDS, value: 0, description: 'Cooldown in test' },
        { key: SETTING_KEYS.OTP_DAILY_LIMIT_PER_TARGET, value: 50, description: 'Daily OTP cap' },
        { key: SETTING_KEYS.LOGIN_MAX_FAILURES, value: 5, description: 'Max login failures' },
        { key: SETTING_KEYS.LOGIN_LOCK_MINUTES, value: 15, description: 'Lockout duration' },
        { key: SETTING_KEYS.MAX_SESSIONS_PER_USER, value: 5, description: 'Max sessions' },
      ],
    });

    // Seed Super Admin with mustChangePassword = true
    const adminHash = await PasswordService.hash(seededAdminPass);
    const admin = await prisma.user.create({
      data: {
        role: ROLES.SUPER_ADMIN,
        status: ACCOUNT_STATUS.APPROVED,
        email: 'admin@autoposter.com',
        mobile: '+919876543211',
        passwordHash: adminHash,
        mustChangePassword: true,
        emailVerifiedAt: new Date(),
        mobileVerifiedAt: new Date(),
      },
    });
    seededAdminId = admin.id;
  }, 30000);

  afterAll(async () => {
    await prisma.$disconnect();
    await disconnectRedis();
  }, 30000);

  // --------------------------------------------------------------------------
  // 1. Driver Passwordless OTP Authentication Flow
  // --------------------------------------------------------------------------
  describe('Driver OTP Flow', () => {
    const driverMobile = '+919876543210';

    it('requests OTP for a driver', async () => {
      const res = await request(app)
        .post('/api/v1/auth/driver/otp/request')
        .send({ mobile: driverMobile });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBeDefined();
    });

    it('verifies OTP and auto-creates driver account on first login', async () => {
      // 123456 is dev bypass code
      const res = await request(app)
        .post('/api/v1/auth/driver/otp/verify')
        .send({
          mobile: driverMobile,
          code: '123456',
          device: { platform: 'ANDROID' },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined(); // Returned in body for mobile
      expect(res.body.data.user.role).toBe(ROLES.DRIVER);
      expect(res.body.data.user.mobile).toBe(driverMobile);

      driverAccessToken = res.body.data.accessToken;

      // Verify user in database
      const user = await prisma.user.findUnique({
        where: { mobile: driverMobile },
      });
      expect(user).not.toBeNull();
      expect(user?.role).toBe(ROLES.DRIVER);
      expect(user?.mobileVerifiedAt).not.toBeNull();
    });

    it('signs in existing driver without creating duplicate', async () => {
      await request(app)
        .post('/api/v1/auth/driver/otp/request')
        .send({ mobile: driverMobile });

      const res = await request(app)
        .post('/api/v1/auth/driver/otp/verify')
        .send({
          mobile: driverMobile,
          code: '123456',
        });

      expect(res.status).toBe(200);
      const totalDrivers = await prisma.user.count({
        where: { mobile: driverMobile },
      });
      expect(totalDrivers).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Company Register, Verify Mobile, and Login Flow
  // --------------------------------------------------------------------------
  describe('Company Auth Flow', () => {
    it('registers a company and triggers mobile OTP', async () => {
      const res = await request(app)
        .post('/api/v1/auth/company/register')
        .send({
          email: companyEmail,
          mobile: companyMobile,
          password: companyPass,
          language: 'en',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.mobile).toBe(companyMobile);

      const user = await prisma.user.findUnique({
        where: { email: companyEmail },
      });
      expect(user?.role).toBe(ROLES.COMPANY);
      expect(user?.status).toBe(ACCOUNT_STATUS.PENDING);
      expect(user?.mobileVerifiedAt).toBeNull(); // Not yet verified
    });

    it('verifies company mobile with OTP', async () => {
      const res = await request(app)
        .post('/api/v1/auth/company/verify-mobile')
        .send({
          mobile: companyMobile,
          code: '123456',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();

      // Check cookie was set
      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();
      expect(cookies.some((c) => c.includes('ap_refresh='))).toBe(true);

      const user = await prisma.user.findUnique({
        where: { email: companyEmail },
      });
      expect(user?.mobileVerifiedAt).not.toBeNull();
    });

    it('logs in company with email and password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/company/login')
        .send({
          email: companyEmail,
          password: companyPass,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe(companyEmail);

      companyAccessToken = res.body.data.accessToken;
    });

    it('rejects wrong password and increments failed attempts', async () => {
      const res = await request(app)
        .post('/api/v1/auth/company/login')
        .send({
          email: companyEmail,
          password: 'WrongPassword999',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  // --------------------------------------------------------------------------
  // 3. Admin 2-Step Login & Forced Password Change Flow
  // --------------------------------------------------------------------------
  describe('Admin 2-Step Verification Flow', () => {
    let challengeId: string;

    it('Step 1: validates email/password and returns 2FA challenge', async () => {
      const res = await request(app)
        .post('/api/v1/auth/admin/login')
        .send({
          email: 'admin@autoposter.com',
          password: seededAdminPass,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.twoFactorRequired).toBe(true);
      expect(res.body.data.challengeId).toBeDefined();
      expect(res.body.data.maskedMobile).toContain('*****');

      challengeId = res.body.data.challengeId;
    });

    it('Step 2: verifies 2FA OTP and issues token with mustChangePassword flag', async () => {
      const res = await request(app)
        .post('/api/v1/auth/admin/verify-otp')
        .send({
          challengeId,
          code: '123456',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.mustChangePassword).toBe(true);
      expect(res.body.data.user.role).toBe(ROLES.SUPER_ADMIN);

      adminAccessToken = res.body.data.accessToken;
    });

    it('changes password and clears mustChangePassword flag', async () => {
      const newPass = 'NewAdminPass2026';
      const res = await request(app)
        .post('/api/v1/auth/password/change')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          currentPassword: seededAdminPass,
          newPassword: newPass,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const user = await prisma.user.findUnique({
        where: { id: seededAdminId },
      });
      expect(user?.mustChangePassword).toBe(false);
      seededAdminPass = newPass;
    });
  });

  // --------------------------------------------------------------------------
  // 4. Token Refresh & Reuse Detection
  // --------------------------------------------------------------------------
  describe('Token Refresh and Session Management', () => {
    let refreshToken: string;
    const testDriverMobile = '+919876543299';

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/auth/driver/otp/verify')
        .send({
          mobile: testDriverMobile,
          code: '123456',
        });
      refreshToken = res.body.data.refreshToken;
    });

    it('rotates refresh token when refreshed', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.refreshToken).not.toBe(refreshToken);

      // Now reuse old refreshToken -> should trigger reuse detection and revoke session
      const reuseRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(reuseRes.status).toBe(401);
      expect(reuseRes.body.error.code).toBe('SESSION_REVOKED');
    });

    it('lists and revokes active sessions', async () => {
      // Create a second session for the company so we can revoke it without invalidating companyAccessToken
      const secondLoginRes = await request(app)
        .post('/api/v1/auth/company/login')
        .send({
          email: companyEmail,
          password: companyPass,
        });
      expect(secondLoginRes.status).toBe(200);

      const listRes = await request(app)
        .get('/api/v1/auth/sessions')
        .set('Authorization', `Bearer ${companyAccessToken}`);

      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body.data)).toBe(true);
      expect(listRes.body.data.length).toBeGreaterThanOrEqual(2);

      const secondPayload = await TokenService.verifyAccessToken(secondLoginRes.body.data.accessToken);

      const revokeRes = await request(app)
        .delete(`/api/v1/auth/sessions/${secondPayload.sessionId}`)
        .set('Authorization', `Bearer ${companyAccessToken}`);

      expect(revokeRes.status).toBe(200);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Authorization Matrix & Prefix Role Guards
  // --------------------------------------------------------------------------
  describe('Role-Based Access Control and Prefix Guards', () => {
    it('allows COMPANY access to /company/ping and rejects others', async () => {
      // Allowed for company
      const okRes = await request(app)
        .get('/api/v1/company/ping')
        .set('Authorization', `Bearer ${companyAccessToken}`);
      expect(okRes.status).toBe(200);

      // Forbidden for driver
      const forbiddenDriver = await request(app)
        .get('/api/v1/company/ping')
        .set('Authorization', `Bearer ${driverAccessToken}`);
      expect(forbiddenDriver.status).toBe(403);
      expect(forbiddenDriver.body.error.code).toBe('FORBIDDEN');

      // Forbidden for unauthenticated
      const unauth = await request(app).get('/api/v1/company/ping');
      expect(unauth.status).toBe(401);
    });

    it('allows ADMIN access to /admin/ping and rejects COMPANY or DRIVER', async () => {
      // Allowed for admin
      const okRes = await request(app)
        .get('/api/v1/admin/ping')
        .set('Authorization', `Bearer ${adminAccessToken}`);
      expect(okRes.status).toBe(200);

      // Forbidden for company
      const forbiddenComp = await request(app)
        .get('/api/v1/admin/ping')
        .set('Authorization', `Bearer ${companyAccessToken}`);
      expect(forbiddenComp.status).toBe(403);
    });

    it('allows DRIVER access to /driver/ping and rejects others', async () => {
      const okRes = await request(app)
        .get('/api/v1/driver/ping')
        .set('Authorization', `Bearer ${driverAccessToken}`);
      expect(okRes.status).toBe(200);

      const forbiddenAdmin = await request(app)
        .get('/api/v1/driver/ping')
        .set('Authorization', `Bearer ${adminAccessToken}`);
      expect(forbiddenAdmin.status).toBe(403);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Admin Team Management Invariants
  // --------------------------------------------------------------------------
  describe('Admin Team Management (/api/v1/admin/team)', () => {
    let createdStaffId: string;

    it('creates a new staff moderator with temporary password', async () => {
      const res = await request(app)
        .post('/api/v1/admin/team')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          email: 'moderator@autoposter.com',
          mobile: '+919876543288',
          role: ROLES.MODERATOR,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.admin.email).toBe('moderator@autoposter.com');
      expect(res.body.data.admin.role).toBe(ROLES.MODERATOR);
      expect(res.body.data.temporaryPassword).toBeDefined();

      createdStaffId = res.body.data.admin.id;
    });

    it('lists admin team members', async () => {
      const res = await request(app)
        .get('/api/v1/admin/team')
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.some((a: { id: string }) => a.id === createdStaffId)).toBe(true);
    });

    it('updates staff role to FINANCE', async () => {
      await prisma.session.updateMany({
        where: { userId: seededAdminId },
        data: { stepUpVerifiedAt: new Date() },
      });

      const res = await request(app)
        .patch(`/api/v1/admin/team/${createdStaffId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ role: ROLES.FINANCE });

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe(ROLES.FINANCE);
    });

    it('prevents demoting the last SUPER_ADMIN', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/team/${seededAdminId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ role: ROLES.MODERATOR });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('updates staff status and revokes sessions on suspension', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/team/${createdStaffId}/status`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ status: ACCOUNT_STATUS.SUSPENDED });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(ACCOUNT_STATUS.SUSPENDED);
    });
  });
});
