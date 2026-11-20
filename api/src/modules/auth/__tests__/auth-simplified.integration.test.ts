import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { prisma } from '../../../shared/db/index.js';
import { createApp } from '../../../app.js';
import { ROLES, ACCOUNT_STATUS, SETTING_KEYS, ERROR_CODES } from '@ap/shared-constants';
import { disconnectRedis, redisClient } from '../../../shared/redis/index.js';
import { env } from '../../../config/env.js';
import { PasswordService } from '../password.service.js';

describe('AG-1: Simplified Authentication Suite (AUTH_OTP_ENABLED = false)', () => {
  const app = createApp();

  let adminId: string;
  let adminAccessToken: string;
  const adminEmail = 'superadmin.simplified@autoposter.in';
  const adminMobile = '+919876540001';
  const adminPass = 'AdminSecret123!';

  const driverMobile = '+919876540002';
  const driverPass = 'DriverSecret123!';

  const companyEmail = 'company.simplified@autoposter.in';
  const companyMobile = '+919876540003';
  const companyPass = 'CompanySecret123!';

  beforeAll(async () => {
    // Explicitly configure OTP disabled mode
    (env as any).AUTH_OTP_ENABLED = false;

    // Reset Redis keys
    await redisClient.flushdb();

    // Clean tables in test schema
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

    // Ensure default settings
    const testSettings = [
      { key: SETTING_KEYS.OTP_LENGTH, value: 6, description: 'OTP length' },
      { key: SETTING_KEYS.OTP_TTL_SECONDS, value: 300, description: 'OTP TTL' },
      { key: SETTING_KEYS.OTP_MAX_ATTEMPTS, value: 5, description: 'OTP max attempts' },
      { key: SETTING_KEYS.OTP_RESEND_COOLDOWN_SECONDS, value: 0, description: 'Cooldown in test' },
      { key: SETTING_KEYS.OTP_DAILY_LIMIT_PER_TARGET, value: 50, description: 'Daily OTP cap' },
      { key: SETTING_KEYS.LOGIN_MAX_FAILURES, value: 3, description: 'Max login failures for lockout' },
      { key: SETTING_KEYS.LOGIN_LOCK_MINUTES, value: 15, description: 'Lockout duration' },
      { key: SETTING_KEYS.MAX_SESSIONS_PER_USER, value: 5, description: 'Max sessions' },
    ];
    for (const s of testSettings) {
      await prisma.setting.upsert({
        where: { key: s.key },
        create: s,
        update: { value: s.value },
      });
    }

    // Create Super Admin with known password
    const adminHash = await PasswordService.hash(adminPass);
    const admin = await prisma.user.create({
      data: {
        role: ROLES.SUPER_ADMIN,
        status: ACCOUNT_STATUS.APPROVED,
        email: adminEmail,
        mobile: adminMobile,
        passwordHash: adminHash,
        mustChangePassword: false,
        emailVerifiedAt: new Date(),
        mobileVerifiedAt: new Date(),
      },
    });
    adminId = admin.id;
  }, 30000);

  afterAll(async () => {
    // Restore env flag and default settings
    (env as any).AUTH_OTP_ENABLED = false;
    await prisma.setting.upsert({
      where: { key: SETTING_KEYS.LOGIN_MAX_FAILURES },
      create: { key: SETTING_KEYS.LOGIN_MAX_FAILURES, value: 5, description: 'Max login failures' },
      update: { value: 5 },
    }).catch(() => {});
    await prisma.$disconnect();
    await disconnectRedis();
  }, 30000);

  // --------------------------------------------------------------------------
  // 1. Public App Config Discovery
  // --------------------------------------------------------------------------
  describe('GET /api/v1/public/app-config', () => {
    it('reports auth.otpEnabled as false and passwordLogin as true', async () => {
      const res = await request(app).get('/api/v1/public/app-config');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.auth).toEqual({
        otpEnabled: false,
        passwordLogin: true,
      });
    });
  });

  // --------------------------------------------------------------------------
  // 2. OTP Endpoints Disabled Rejection
  // --------------------------------------------------------------------------
  describe('OTP Endpoints Gating', () => {
    it('rejects POST /api/v1/auth/driver/otp/request with OTP_DISABLED', async () => {
      const res = await request(app)
        .post('/api/v1/auth/driver/otp/request')
        .send({ mobile: driverMobile });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.OTP_DISABLED);
    });

    it('rejects POST /api/v1/auth/driver/otp/verify with OTP_DISABLED', async () => {
      const res = await request(app)
        .post('/api/v1/auth/driver/otp/verify')
        .send({ mobile: driverMobile, code: '123456' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.OTP_DISABLED);
    });

    it('rejects POST /api/v1/auth/company/verify-mobile with OTP_DISABLED', async () => {
      const res = await request(app)
        .post('/api/v1/auth/company/verify-mobile')
        .send({ mobile: companyMobile, code: '123456' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.OTP_DISABLED);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Driver Password Registration and Login Flow
  // --------------------------------------------------------------------------
  describe('Driver Password Flow', () => {
    it('registers a new driver with mobile and password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/driver/register')
        .send({
          mobile: driverMobile,
          password: driverPass,
          language: 'en',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user.role).toBe(ROLES.DRIVER);
      expect(res.body.data.user.mobile).toBe(driverMobile);

      // Verify DB record
      const dbUser = await prisma.user.findUnique({
        where: { mobile: driverMobile },
        include: { driverProfile: true },
      });
      expect(dbUser).not.toBeNull();
      expect(dbUser?.driverProfile).not.toBeNull();
      expect(dbUser?.mobileVerifiedAt).not.toBeNull();
    });

    it('rejects duplicate driver registration', async () => {
      const res = await request(app)
        .post('/api/v1/auth/driver/register')
        .send({
          mobile: driverMobile,
          password: driverPass,
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('logs in driver with valid mobile and password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/driver/login')
        .send({
          mobile: driverMobile,
          password: driverPass,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user.role).toBe(ROLES.DRIVER);
    });

    it('registers driver with name, mobile, email and allows login with both email and mobile', async () => {
      const fullDriverMobile = '+919876541122';
      const fullDriverEmail = 'driver.test@autoposter.com';
      const regRes = await request(app)
        .post('/api/v1/auth/driver/register')
        .send({
          name: 'Ramesh Patel',
          mobile: fullDriverMobile,
          email: fullDriverEmail,
          password: 'Password123!',
        });
      expect(regRes.status).toBe(201);
      expect(regRes.body.success).toBe(true);

      // Verify DB record has full name in driverProfile
      const dbUser = await prisma.user.findUnique({
        where: { mobile: fullDriverMobile },
        include: { driverProfile: true },
      });
      expect(dbUser?.driverProfile?.fullName).toBe('Ramesh Patel');
      expect(dbUser?.email).toBe(fullDriverEmail);

      // Login using email
      const emailLoginRes = await request(app)
        .post('/api/v1/auth/driver/login')
        .send({
          identifier: fullDriverEmail,
          password: 'Password123!',
        });
      expect(emailLoginRes.status).toBe(200);
      expect(emailLoginRes.body.success).toBe(true);
      expect(emailLoginRes.body.data.accessToken).toBeDefined();

      // Login using mobile
      const mobileLoginRes = await request(app)
        .post('/api/v1/auth/driver/login')
        .send({
          identifier: fullDriverMobile,
          password: 'Password123!',
        });
      expect(mobileLoginRes.status).toBe(200);
      expect(mobileLoginRes.body.success).toBe(true);
      expect(mobileLoginRes.body.data.accessToken).toBeDefined();
    });

    it('rejects driver login with wrong password and locks account after repeated attempts', async () => {
      const attackerMobile = '+919876540099';
      // Register test driver
      await request(app)
        .post('/api/v1/auth/driver/register')
        .send({ mobile: attackerMobile, password: 'CorrectPass123!' });

      // First 2 invalid attempts return 401
      const res1 = await request(app)
        .post('/api/v1/auth/driver/login')
        .send({ mobile: attackerMobile, password: 'WrongPassword999!' });
      expect(res1.status).toBe(401);

      const res2 = await request(app)
        .post('/api/v1/auth/driver/login')
        .send({ mobile: attackerMobile, password: 'WrongPassword999!' });
      expect(res2.status).toBe(401);

      // 3rd failed attempt hits maxFailures (3) and returns 429 TOO_MANY_LOGIN_ATTEMPTS
      const res3 = await request(app)
        .post('/api/v1/auth/driver/login')
        .send({ mobile: attackerMobile, password: 'WrongPassword999!' });
      expect(res3.status).toBe(429);
      expect(res3.body.error.code).toBe(ERROR_CODES.TOO_MANY_LOGIN_ATTEMPTS);

      // Subsequent attempt while locked out returns 429 TOO_MANY_LOGIN_ATTEMPTS
      const lockedRes = await request(app)
        .post('/api/v1/auth/driver/login')
        .send({ mobile: attackerMobile, password: 'CorrectPass123!' });

      expect(lockedRes.status).toBe(429);
      expect(lockedRes.body.error.code).toBe(ERROR_CODES.TOO_MANY_LOGIN_ATTEMPTS);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Company Registration without Mobile OTP
  // --------------------------------------------------------------------------
  describe('Company Registration & Login (OTP Off)', () => {
    it('registers company as immediately approved and verified', async () => {
      const res = await request(app)
        .post('/api/v1/auth/company/register')
        .send({
          companyName: 'Instant Tech Corp',
          contactName: 'Ravi Tech',
          email: companyEmail,
          mobile: companyMobile,
          password: companyPass,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBeDefined();

      // Verify DB record has mobileVerifiedAt set
      const dbUser = await prisma.user.findUnique({
        where: { email: companyEmail },
      });
      expect(dbUser?.mobileVerifiedAt).not.toBeNull();
    });

    it('allows company to log in immediately without OTP', async () => {
      const res = await request(app)
        .post('/api/v1/auth/company/login')
        .send({
          email: companyEmail,
          password: companyPass,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.role).toBe(ROLES.COMPANY);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Admin 1-Step Login & Step-Up with Password
  // --------------------------------------------------------------------------
  describe('Admin Auth & Step-Up (OTP Off)', () => {
    it('logs in admin in 1 single step directly returning session tokens', async () => {
      const res = await request(app)
        .post('/api/v1/auth/admin/login')
        .send({
          email: adminEmail,
          password: adminPass,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.role).toBe(ROLES.SUPER_ADMIN);

      adminAccessToken = res.body.data.accessToken;
    });

    it('verifies step-up authorization using user password', async () => {
      const res = await request(app)
        .post('/api/v1/admin/step-up/verify')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          action: 'BANK_ACCOUNT_UPDATE',
          password: adminPass,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.stepUpVerified).toBe(true);
    });

    it('rejects step-up with incorrect password', async () => {
      const res = await request(app)
        .post('/api/v1/admin/step-up/verify')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          action: 'BANK_ACCOUNT_UPDATE',
          password: 'IncorrectPassword!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.STEP_UP_INVALID);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Admin User Password Reset
  // --------------------------------------------------------------------------
  describe('Admin User Password Reset (POST /api/v1/admin/users/:id/reset-password)', () => {
    it('allows SUPER_ADMIN to generate temporary password for a user', async () => {
      // Create a moderator user
      const modPass = 'ModeratorOld123!';
      const modHash = await PasswordService.hash(modPass);
      const mod = await prisma.user.create({
        data: {
          role: ROLES.MODERATOR,
          status: ACCOUNT_STATUS.APPROVED,
          email: 'mod.reset.test@autoposter.in',
          mobile: '+919876540088',
          passwordHash: modHash,
          preferredLanguage: 'en',
          emailVerifiedAt: new Date(),
          mobileVerifiedAt: new Date(),
        },
      });

      const res = await request(app)
        .post(`/api/v1/admin/users/${mod.id}/reset-password`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ notify: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.temporaryPassword).toBeDefined();
      expect(res.body.data.mustChangePassword).toBe(true);

      const tempPassword = res.body.data.temporaryPassword;

      // Moderator logs in with temporary password
      const loginRes = await request(app)
        .post('/api/v1/auth/admin/login')
        .send({
          email: 'mod.reset.test@autoposter.in',
          password: tempPassword,
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.user.mustChangePassword).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 7. Production Guardrail: Refuses Boot when OTP is Disabled
  // --------------------------------------------------------------------------
  describe('Production Guardrail', () => {
    it('strictly prohibits AUTH_OTP_ENABLED=false when NODE_ENV is production', async () => {
      const { envSchema } = await import('../../../config/env.js');
      const testEnv = {
        ...process.env,
        NODE_ENV: 'production',
        DB_ENVIRONMENT: 'production',
        AUTH_OTP_ENABLED: 'false',
        OTP_HMAC_SECRET: 'test-secret-at-least-32-chars-long!',
      };

      const result = envSchema.safeParse(testEnv);
      expect(result.success).toBe(false);
      if (!result.success) {
        const otpIssue = result.error.issues.find((i) => i.path.includes('AUTH_OTP_ENABLED'));
        expect(otpIssue).toBeDefined();
        expect(otpIssue?.message).toContain('AUTH_OTP_ENABLED must be true');
      }
    });
  });
});
