import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '../shared/db/index.js';
import { disconnectRedis } from '../shared/redis/index.js';
import { TokenService } from '../modules/auth/token.service.js';
import { storageProvider } from '../integrations/storage/index.js';
import { ROLES, ACCOUNT_STATUS } from '@ap/shared-constants';

describe('Suite 1: Public, Shared & Utility Endpoints', () => {
  const app = createApp();

  let testUserId: string;
  let userToken: string;
  let cityId: string;
  let helpArticleId: string;

  beforeAll(async () => {
    // Mock storage operations so tests never attempt real S3/Supabase upload/download calls
    const PNG_1X1_BUFFER = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );
    vi.spyOn(storageProvider, 'getObject').mockResolvedValue(PNG_1X1_BUFFER);
    vi.spyOn(storageProvider, 'putObject').mockResolvedValue(undefined as any);

    // 1. Clean test tables
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "notifications",
        "device_tokens",
        "help_articles",
        "legal_documents",
        "zones",
        "cities",
        "sessions",
        "users"
      CASCADE;
    `);

    // 2. Seed test user & token first
    const user = await prisma.user.create({
      data: {
        role: ROLES.DRIVER,
        status: ACCOUNT_STATUS.APPROVED,
        mobile: '+919876541111',
        preferredLanguage: 'en',
        emailVerifiedAt: new Date(),
        mobileVerifiedAt: new Date(),
      },
    });
    testUserId = user.id;

    const { accessToken } = await TokenService.createSession({
      userId: user.id,
      platform: 'ANDROID',
    });
    userToken = accessToken;

    // 3. Seed test city & zone
    const city = await prisma.city.create({
      data: {
        name: 'Ahmedabad',
        state: 'Gujarat',
        country: 'IN',
        isActive: true,
      },
    });
    cityId = city.id;

    await prisma.zone.create({
      data: {
        cityId: city.id,
        name: 'Navrangpura',
        centerLat: 23.0365,
        centerLng: 72.5611,
        radiusMeters: 5000,
        isActive: true,
      },
    });

    // 4. Seed legal document
    await prisma.legalDocument.create({
      data: {
        type: 'TERMS',
        language: 'en',
        version: 1,
        title: 'Platform Terms & Conditions',
        bodyMarkdown: 'These are the official terms of the platform.',
        status: 'PUBLISHED',
        createdById: testUserId,
      },
    });

    // 5. Seed help article
    const article = await prisma.helpArticle.create({
      data: {
        category: 'DRIVER',
        language: 'en',
        title: 'How Daily Proof Works',
        bodyMarkdown: 'Drivers must submit daily photos of their auto-rickshaw poster.',
        sortOrder: 1,
        published: true,
        updatedById: testUserId,
      },
    });
    helpArticleId = article.id;
  }, 30000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.$disconnect();
    await disconnectRedis();
  }, 30000);

  // --------------------------------------------------------------------------
  // 1. Health Endpoints
  // --------------------------------------------------------------------------
  describe('Health Endpoints', () => {
    it('GET /api/v1/health returns health status', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ok');
    });

    it('GET /api/v1/health/ready returns readiness with db & redis status', async () => {
      const res = await request(app).get('/api/v1/health/ready');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ready');
      expect(res.body.data.checks.database).toBe('ok');
    });
  });

  // --------------------------------------------------------------------------
  // 2. Public Endpoints
  // --------------------------------------------------------------------------
  describe('Public Endpoints', () => {
    it('GET /api/v1/public/app-config returns public configuration', async () => {
      const res = await request(app).get('/api/v1/public/app-config');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.environment).toBeDefined();
      expect(res.body.data.auth).toBeDefined();
    });

    it('GET /api/v1/public/environment returns environment metadata', async () => {
      const res = await request(app).get('/api/v1/public/environment');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.environment).toBeDefined();
    });

    it('GET /api/v1/public/invite-codes/:code/validate checks code validity', async () => {
      const res = await request(app).get('/api/v1/public/invite-codes/INVALIDCODE/validate');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.valid).toBe(false);
    });

    it('POST /api/v1/public/waitlist registers interest', async () => {
      const res = await request(app)
        .post('/api/v1/public/waitlist')
        .send({
          role: 'COMPANY',
          contact: 'waitlist.user@example.com',
          cityName: 'Ahmedabad',
          consent: true,
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Locations, Legal & Help Endpoints
  // --------------------------------------------------------------------------
  describe('Locations, Legal & Help Endpoints', () => {
    it('GET /api/v1/locations/cities returns active cities', async () => {
      const res = await request(app).get('/api/v1/locations/cities');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].name).toBe('Ahmedabad');
    });

    it('GET /api/v1/locations/cities/:id/zones returns zones for city', async () => {
      const res = await request(app).get(`/api/v1/locations/cities/${cityId}/zones`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0].name).toBe('Navrangpura');
    });

    it('GET /api/v1/legal/versions returns active legal versions', async () => {
      const res = await request(app).get('/api/v1/legal/versions');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/v1/legal/:type returns specific legal document', async () => {
      const res = await request(app).get('/api/v1/legal/TERMS');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe('TERMS');
      expect(res.body.data.title).toBe('Platform Terms & Conditions');
    });

    it('GET /api/v1/help returns published help articles', async () => {
      const res = await request(app).get('/api/v1/help');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('GET /api/v1/help/:id returns single help article', async () => {
      const res = await request(app).get(`/api/v1/help/${helpArticleId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('How Daily Proof Works');
    });
  });

  // --------------------------------------------------------------------------
  // 4. Uploads Endpoints
  // --------------------------------------------------------------------------
  describe('Uploads Endpoints', () => {
    let generatedFileKey: string;

    it('rejects unauthenticated upload requests with 401', async () => {
      const res = await request(app)
        .post('/api/v1/uploads/presign')
        .send({
          purpose: 'DAILY_PHOTO',
          mimeType: 'image/png',
          sizeBytes: 102400,
        });
      expect(res.status).toBe(401);
    });

    it('generates presigned upload URL for authenticated user', async () => {
      const res = await request(app)
        .post('/api/v1/uploads/presign')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          purpose: 'DAILY_PHOTO',
          mimeType: 'image/png',
          sizeBytes: 102400,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.uploadUrl).toBeDefined();
      expect(res.body.data.fileKey).toBeDefined();
      generatedFileKey = res.body.data.fileKey;
    });

    it('confirms uploaded file', async () => {
      const res = await request(app)
        .post('/api/v1/uploads/confirm')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          fileKey: generatedFileKey,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.fileKey).toBe(generatedFileKey);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Devices & Notifications Endpoints
  // --------------------------------------------------------------------------
  describe('Devices & Notifications Endpoints', () => {
    const fcmToken = 'fcm-device-token-1234567890';

    it('registers a push notification device token', async () => {
      const res = await request(app)
        .post('/api/v1/devices')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          token: fcmToken,
          platform: 'ANDROID',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBe(fcmToken);

      const dbToken = await prisma.deviceToken.findUnique({
        where: {
          userId_token: {
            userId: testUserId,
            token: fcmToken,
          },
        },
      });
      expect(dbToken).not.toBeNull();
      expect(dbToken?.userId).toBe(testUserId);
    });

    it('unregisters device token', async () => {
      const res = await request(app)
        .delete(`/api/v1/devices/${fcmToken}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const dbToken = await prisma.deviceToken.findUnique({
        where: {
          userId_token: {
            userId: testUserId,
            token: fcmToken,
          },
        },
      });
      expect(dbToken?.disabledAt).not.toBeNull();
    });

    it('lists notifications for authenticated user', async () => {
      // Seed a test notification
      await prisma.notification.create({
        data: {
          userId: testUserId,
          category: 'CAMPAIGN_UPDATES',
          channel: 'IN_APP',
          title: 'Photo Approved',
          body: 'Your daily photo proof has been approved.',
        },
      });

      const res = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('fetches unread notification count', async () => {
      const res = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data).toBe('number');
      expect(res.body.data).toBeGreaterThan(0);
    });

    it('marks all notifications as read', async () => {
      const res = await request(app)
        .post('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const countRes = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${userToken}`);
      expect(countRes.body.data).toBe(0);
    });

    it('manages user notification preferences and settings', async () => {
      const getRes = await request(app)
        .get('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${userToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.success).toBe(true);

      const updatePrefRes = await request(app)
        .put('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          preferences: [
            {
              category: 'CAMPAIGN_UPDATES',
              channel: 'IN_APP',
              enabled: true,
            },
          ],
        });

      expect(updatePrefRes.status).toBe(200);
      expect(updatePrefRes.body.success).toBe(true);

      const updateSettingsRes = await request(app)
        .put('/api/v1/notifications/settings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          language: 'hi',
          quietHoursStart: '22:00',
          quietHoursEnd: '07:00',
        });

      expect(updateSettingsRes.status).toBe(200);
      expect(updateSettingsRes.body.success).toBe(true);
    });
  });
});
