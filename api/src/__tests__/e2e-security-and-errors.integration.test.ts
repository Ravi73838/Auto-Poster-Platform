import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { createApp } from '../app.js';
import { prisma } from '../shared/db/index.js';
import { TokenService } from '../modules/auth/token.service.js';
import { PasswordService } from '../modules/auth/password.service.js';
import { disconnectRedis } from '../shared/redis/index.js';
import {
  ROLES,
  ACCOUNT_STATUS,
  ERROR_CODES,
} from '@ap/shared-constants';

describe('Suite 6: Security, RBAC & Negative Boundary Matrix', () => {
  const app = createApp();

  // Test identities
  let superAdminToken: string;
  let moderatorToken: string;
  let companyToken: string;
  let driverToken: string;
  let suspendedDriverToken: string;
  let pendingDriverToken: string;

  let superAdminId: string;
  let moderatorId: string;
  let companyId: string;
  let driverId: string;
  let suspendedDriverId: string;
  let pendingDriverId: string;

  beforeAll(async () => {
    // 1. Clean test tables
    await prisma.session.deleteMany();
    await prisma.driverProfile.deleteMany();
    await prisma.companyProfile.deleteMany();

    const passwordHash = await PasswordService.hash('StrongSecurityPass#2026!');

    // 2. Super Admin user
    const superAdmin = await prisma.user.create({
      data: {
        mobile: `+9199${Math.floor(10000000 + Math.random() * 90000000)}`,
        email: `sec_superadmin_${Date.now()}@autoposter.test`,
        passwordHash,
        role: ROLES.SUPER_ADMIN,
        status: ACCOUNT_STATUS.APPROVED,
        emailVerifiedAt: new Date(),
        mobileVerifiedAt: new Date(),
      },
    });
    superAdminId = superAdmin.id;
    const superAdminSession = await TokenService.createSession({
      userId: superAdminId,
      userAgent: 'security-test-agent',
      ipAddress: '127.0.0.1',
    });
    superAdminToken = superAdminSession.accessToken;

    // 3. Moderator Admin user (no finance permissions)
    const moderator = await prisma.user.create({
      data: {
        mobile: `+9199${Math.floor(10000000 + Math.random() * 90000000)}`,
        email: `sec_moderator_${Date.now()}@autoposter.test`,
        passwordHash,
        role: ROLES.MODERATOR,
        status: ACCOUNT_STATUS.APPROVED,
        emailVerifiedAt: new Date(),
        mobileVerifiedAt: new Date(),
      },
    });
    moderatorId = moderator.id;
    const moderatorSession = await TokenService.createSession({
      userId: moderatorId,
      userAgent: 'security-test-agent',
      ipAddress: '127.0.0.1',
    });
    moderatorToken = moderatorSession.accessToken;

    // 4. Company user
    const company = await prisma.user.create({
      data: {
        mobile: `+9199${Math.floor(10000000 + Math.random() * 90000000)}`,
        email: `sec_company_${Date.now()}@autoposter.test`,
        passwordHash,
        role: ROLES.COMPANY,
        status: ACCOUNT_STATUS.APPROVED,
        emailVerifiedAt: new Date(),
        mobileVerifiedAt: new Date(),
      },
    });
    companyId = company.id;
    await prisma.companyProfile.create({
      data: {
        userId: companyId,
        companyName: 'Security Test Brand Pvt Ltd',
        contactPersonName: 'Security Manager',
        contactPersonPhone: '+919988776655',
      },
    });
    const companySession = await TokenService.createSession({
      userId: companyId,
      userAgent: 'security-test-agent',
      ipAddress: '127.0.0.1',
    });
    companyToken = companySession.accessToken;

    // 5. Active Driver user
    const driver = await prisma.user.create({
      data: {
        mobile: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
        passwordHash,
        role: ROLES.DRIVER,
        status: ACCOUNT_STATUS.APPROVED,
        mobileVerifiedAt: new Date(),
      },
    });
    driverId = driver.id;
    await prisma.driverProfile.create({
      data: {
        userId: driverId,
        fullName: 'Security Active Driver',
      },
    });
    const driverSession = await TokenService.createSession({
      userId: driverId,
      userAgent: 'security-test-agent',
      ipAddress: '127.0.0.1',
    });
    driverToken = driverSession.accessToken;

    // 6. Suspended Driver user
    const suspendedDriver = await prisma.user.create({
      data: {
        mobile: `+9197${Math.floor(10000000 + Math.random() * 90000000)}`,
        passwordHash,
        role: ROLES.DRIVER,
        status: ACCOUNT_STATUS.SUSPENDED,
        mobileVerifiedAt: new Date(),
      },
    });
    suspendedDriverId = suspendedDriver.id;
    await prisma.driverProfile.create({
      data: {
        userId: suspendedDriverId,
        fullName: 'Security Suspended Driver',
      },
    });
    const suspendedSession = await TokenService.createSession({
      userId: suspendedDriverId,
      userAgent: 'security-test-agent',
      ipAddress: '127.0.0.1',
    });
    suspendedDriverToken = suspendedSession.accessToken;

    // 7. Pending Approval Driver user
    const pendingDriver = await prisma.user.create({
      data: {
        mobile: `+9196${Math.floor(10000000 + Math.random() * 90000000)}`,
        passwordHash,
        role: ROLES.DRIVER,
        status: ACCOUNT_STATUS.PENDING,
        mobileVerifiedAt: new Date(),
      },
    });
    pendingDriverId = pendingDriver.id;
    await prisma.driverProfile.create({
      data: {
        userId: pendingDriverId,
        fullName: 'Security Pending Driver',
      },
    });
    const pendingSession = await TokenService.createSession({
      userId: pendingDriverId,
      userAgent: 'security-test-agent',
      ipAddress: '127.0.0.1',
    });
    pendingDriverToken = pendingSession.accessToken;
  }, 60000);

  afterAll(async () => {
    await disconnectRedis();
    await prisma.$disconnect();
  });

  // ===========================================================================
  // 1. AUTHENTICATION (401 UNAUTHORIZED)
  // ===========================================================================
  describe('1. Authentication Guard & Token Validation (401)', () => {
    it('GET /api/v1/auth/me rejects request without Authorization header', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
    });

    it('GET /api/v1/auth/me rejects malformed Bearer token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer totally-invalid-token-string');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/v1/auth/me rejects tampered JWT signature', async () => {
      const tampered = `${driverToken.slice(0, -6)}tamper`;
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${tampered}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/v1/auth/me rejects expired / revoked session token', async () => {
      // Create and immediately revoke a session
      const tempSession = await TokenService.createSession({
        userId: driverId,
        userAgent: 'revoked-test-agent',
        ipAddress: '127.0.0.1',
      });
      await prisma.session.delete({ where: { id: tempSession.session.id } });

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${tempSession.accessToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/v1/auth/me succeeds with valid active session token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${driverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe(driverId);
    });
  });

  // ===========================================================================
  // 2. ROLE-BASED ACCESS CONTROL (403 FORBIDDEN MATRIX)
  // ===========================================================================
  describe('2. Role-Based Access Control Matrix (403)', () => {
    it('DRIVER token accessing Admin endpoints is forbidden (403)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${driverToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('DRIVER token accessing Company campaigns is forbidden (403)', async () => {
      const res = await request(app)
        .get('/api/v1/company/campaigns')
        .set('Authorization', `Bearer ${driverToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('COMPANY token accessing Driver profile is forbidden (403)', async () => {
      const res = await request(app)
        .get('/api/v1/driver/profile')
        .set('Authorization', `Bearer ${companyToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('COMPANY token accessing Admin finance dashboard is forbidden (403)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/finance/dashboard')
        .set('Authorization', `Bearer ${companyToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('MODERATOR token lacking finance permission is forbidden on finance actions (403)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/finance/pause')
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({
          payoutsEnabled: false,
          paymentsEnabled: false,
          reason: 'Unauthorized moderator test attempt',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  // ===========================================================================
  // 3. ACCOUNT STATUS ENFORCEMENT (SUSPENDED & UNAPPROVED)
  // ===========================================================================
  describe('3. Account Status Enforcement (Suspended & Unapproved)', () => {
    it('SUSPENDED driver is permitted to read own profile (GET)', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${suspendedDriverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(ACCOUNT_STATUS.SUSPENDED);
    });

    it('SUSPENDED driver is blocked from write operations (POST 403)', async () => {
      const res = await request(app)
        .post('/api/v1/driver/assignments')
        .set('Authorization', `Bearer ${suspendedDriverToken}`)
        .send({ campaignId: crypto.randomUUID() });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.ACCOUNT_SUSPENDED);
    });

    it('PENDING driver is blocked from endpoints requiring approved status (403)', async () => {
      const res = await request(app)
        .post('/api/v1/driver/assignments')
        .set('Authorization', `Bearer ${pendingDriverToken}`)
        .send({ campaignId: crypto.randomUUID() });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.ACCOUNT_NOT_APPROVED);
    });
  });

  // ===========================================================================
  // 4. INPUT VALIDATION & NEGATIVE BOUNDARIES (400)
  // ===========================================================================
  describe('4. Input Validation & Negative Boundary Enforcement (400)', () => {
    it('POST /api/v1/auth/driver/login rejects empty request body', async () => {
      const res = await request(app)
        .post('/api/v1/auth/driver/login')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('POST /api/v1/auth/driver/login rejects invalid format identifier', async () => {
      const res = await request(app)
        .post('/api/v1/auth/driver/login')
        .send({
          mobileNumber: 'not-a-valid-phone',
          password: 'Password123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('GET /api/v1/company/campaigns/:id rejects non-UUID parameter', async () => {
      const res = await request(app)
        .get('/api/v1/company/campaigns/not-a-valid-uuid-string')
        .set('Authorization', `Bearer ${companyToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('POST /api/v1/company/campaigns rejects negative dailyRentPaise', async () => {
      const res = await request(app)
        .post('/api/v1/company/campaigns')
        .set('Authorization', `Bearer ${companyToken}`)
        .send({
          title: 'Invalid Negative Budget Campaign',
          cityId: crypto.randomUUID(),
          dailyRentPaise: -500,
          targetAutoCount: 1,
          startDate: '2026-12-01',
          endDate: '2026-12-15',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ===========================================================================
  // 5. STEP-UP AUTHENTICATION ENFORCEMENT
  // ===========================================================================
  describe('5. Step-Up Verification Enforcement', () => {
    it('Super admin attempting sensitive finance pause without step-up is rejected (403)', async () => {
      // Create fresh super admin session without step-up
      const freshAdminSession = await TokenService.createSession({
        userId: superAdminId,
        userAgent: 'fresh-security-agent',
        ipAddress: '127.0.0.1',
      });

      const res = await request(app)
        .post('/api/v1/admin/finance/pause')
        .set('Authorization', `Bearer ${freshAdminSession.accessToken}`)
        .send({
          payoutsEnabled: false,
          paymentsEnabled: false,
          reason: 'Testing step up enforcement',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.STEP_UP_REQUIRED);
      expect(res.body.error.details.stepUpRequired).toBe(true);
    });

    it('POST /api/v1/admin/step-up/verify rejects incorrect password (400)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/step-up/verify')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ password: 'WrongPassword#999' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.STEP_UP_INVALID);
    });

    it('POST /api/v1/admin/step-up/verify succeeds with correct password', async () => {
      const res = await request(app)
        .post('/api/v1/admin/step-up/verify')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ password: 'StrongSecurityPass#2026!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.stepUpVerified).toBe(true);
    });
  });

  // ===========================================================================
  // 6. SECURITY HEADERS & OBSERVABILITY
  // ===========================================================================
  describe('6. Security Headers & Request Correlation', () => {
    it('Responses include helmet security headers (nosniff, frameguard)', async () => {
      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBeDefined();
    });

    it('Responses include unique x-request-id header for correlation', async () => {
      const res = await request(app).get('/api/v1/health');

      expect(res.headers['x-request-id']).toBeDefined();
      expect(typeof res.headers['x-request-id']).toBe('string');
      expect((res.headers['x-request-id'] as string).length).toBeGreaterThan(0);
    });
  });
});
