import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { createApp } from '../app.js';
import { prisma } from '../shared/db/index.js';
import { disconnectRedis } from '../shared/redis/index.js';
import { TokenService } from '../modules/auth/token.service.js';
import { PasswordService } from '../modules/auth/password.service.js';
import { storageProvider } from '../integrations/storage/index.js';
import {
  ROLES,
  ACCOUNT_STATUS,
  CAMPAIGN_STATUS,
  ASSIGNMENT_STATUS,
  DAILY_PHOTO_STATUS,
  DISPUTE_STATUS,
  DISPUTE_REASONS,
  STRIKE_REASONS,
  LEGAL_DOCUMENT_TYPES,
  SETTING_KEYS,
  FILE_PURPOSES,
} from '@ap/shared-constants';

describe('Suite 4: Admin Domain Flow Endpoints', () => {
  const app = createApp();

  // Test IDs
  let adminUserId: string;
  let adminSessionId: string;
  let adminToken: string;

  let secondaryAdminId: string;

  let cityId: string;
  let zoneId: string;

  let driverUserId: string;
  let driverProfileId: string;
  let companyUserId: string;
  let companyProfileId: string;

  let campaignId: string;
  let assignmentId: string;
  let dailyPhotoId: string;
  let disputeId: string;
  let strikeId: string;
  let savedViewId: string;
  let helpArticleId: string;
  let inviteCodeId: string;
  let printShopId: string;

  beforeAll(async () => {
    // 0. Mock storage operations
    const VALID_PNG_BUFFER = await sharp({
      create: {
        width: 400,
        height: 400,
        channels: 4,
        background: { r: 10, g: 150, b: 200, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    vi.spyOn(storageProvider, 'getObject').mockResolvedValue(VALID_PNG_BUFFER);
    vi.spyOn(storageProvider, 'putObject').mockResolvedValue(undefined as any);
    vi.spyOn(storageProvider, 'getSignedReadUrl').mockResolvedValue('https://mock-storage.test/file.png');

    // 1. Clean test tables
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "review_second_looks",
        "anomaly_findings",
        "print_shops",
        "invite_codes",
        "waitlist_entries",
        "help_articles",
        "legal_documents",
        "setting_change_requests",
        "saved_views",
        "driver_bans",
        "strikes",
        "dispute_messages",
        "disputes",
        "tax_documents",
        "campaign_payments",
        "photos",
        "assignment_days",
        "assignment_settlements",
        "assignments",
        "campaign_reviews",
        "campaign_zones",
        "campaigns",
        "documents",
        "uploaded_files",
        "driver_zones",
        "vehicles",
        "driver_profiles",
        "company_profiles",
        "zones",
        "cities",
        "sessions",
        "users"
      CASCADE;
    `);

    // 2. Seed City and Zone
    const city = await prisma.city.create({
      data: {
        name: 'Ahmedabad Admin',
        state: 'Gujarat',
        country: 'IN',
        isActive: true,
      },
    });
    cityId = city.id;

    const zone = await prisma.zone.create({
      data: {
        cityId,
        name: 'Navrangpura Hub',
        pinCodes: ['380009'],
        centerLat: 23.03,
        centerLng: 72.56,
        radiusMeters: 5000,
        isActive: true,
      },
    });
    zoneId = zone.id;

    // 3. Seed Super Admin User & Session
    const passwordHash = await PasswordService.hash('SuperAdminStrongPass#2026!');
    const adminUser = await prisma.user.create({
      data: {
        role: ROLES.SUPER_ADMIN,
        email: 'superadmin@autoposter.test',
        mobile: '+919999900001',
        passwordHash,
        status: ACCOUNT_STATUS.APPROVED,
        emailVerifiedAt: new Date(),
        mobileVerifiedAt: new Date(),
      },
    });
    adminUserId = adminUser.id;

    const sessionRes = await TokenService.createSession({
      userId: adminUserId,
      platform: 'WEB',
    });
    adminSessionId = sessionRes.sessionId;
    adminToken = sessionRes.accessToken;

    // 4. Seed Company User & Profile
    const companyUser = await prisma.user.create({
      data: {
        role: ROLES.COMPANY,
        email: 'company-for-admin@test.com',
        mobile: '+919876500011',
        status: ACCOUNT_STATUS.APPROVED,
        emailVerifiedAt: new Date(),
      },
    });
    companyUserId = companyUser.id;

    const companyProfile = await prisma.companyProfile.create({
      data: {
        userId: companyUserId,
        companyName: 'Apex Brands Pvt Ltd',
        legalName: 'Apex Brands Pvt Ltd',
        brandName: 'Apex Brand',
        cityId,
        contactPersonName: 'Gautam Patel',
        contactPersonPhone: '+919876500011',
        isVerified: true,
      },
    });
    companyProfileId = companyProfile.id;

    // 5. Seed Driver User & Profile
    const driverUser = await prisma.user.create({
      data: {
        role: ROLES.DRIVER,
        mobile: '+919876500012',
        status: ACCOUNT_STATUS.APPROVED,
        mobileVerifiedAt: new Date(),
      },
    });
    driverUserId = driverUser.id;

    const driverProfile = await prisma.driverProfile.create({
      data: {
        userId: driverUserId,
        fullName: 'Ramesh Patel',
        cityId,
      },
    });
    driverProfileId = driverProfile.id;

    const vehicle = await prisma.vehicle.create({
      data: {
        registrationNumber: 'GJ01AP9999',
        vehicleType: 'AUTO_RICKSHAW',
        isVerified: true,
      },
    });

    // 6. Seed an Uploaded File (Poster)
    const posterFile = await prisma.uploadedFile.create({
      data: {
        ownerUserId: companyUserId,
        fileKey: 'company/posters/poster-admin.png',
        purpose: FILE_PURPOSES.CAMPAIGN_POSTER,
        mimeType: 'image/png',
        sizeBytes: 1024,
        status: 'CONFIRMED',
      },
    });

    // 7. Seed Campaign in SUBMITTED status for review queue testing
    const campaign = await prisma.campaign.create({
      data: {
        companyId: companyUserId,
        title: 'Monsoon Mega Sale',
        cityId,
        posterFileId: posterFile.id,
        targetAutoCount: 5,
        dailyRentPaise: 8000,
        printingAllowancePaise: 50000,
        totalBudgetPaise: 560000n,
        platformFeePaise: 56000n,
        gstAmountPaise: 10080n,
        totalChargedPaise: 626080n,
        startDate: new Date('2026-12-01'),
        endDate: new Date('2026-12-14'),
        status: CAMPAIGN_STATUS.SUBMITTED,
      },
    });
    campaignId = campaign.id;

    await prisma.campaignZone.create({
      data: {
        campaignId,
        zoneId,
      },
    });

    // 8. Seed Assignment in INSTALL_SUBMITTED status for installation review testing
    const assignment = await prisma.assignment.create({
      data: {
        campaignId,
        driverId: driverUserId,
        vehicleId: vehicle.id,
        status: ASSIGNMENT_STATUS.INSTALL_SUBMITTED,
        reservedAt: new Date('2026-12-01'),
        expiresAt: new Date('2026-12-14'),
        totalDays: 14,
      },
    });
    assignmentId = assignment.id;

    await prisma.photo.create({
      data: {
        assignmentId,
        driverId: driverUserId,
        kind: 'INSTALLATION',
        photoUrl: 'photos/install-admin.png',
        lat: 23.03,
        lng: 72.56,
        accuracyMeters: 10,
        capturedAt: new Date(),
        status: 'PENDING_CHECK',
      },
    });

    // 9. Seed Daily Photo in SUBMITTED status
    const photo = await prisma.photo.create({
      data: {
        assignmentId,
        driverId: driverUserId,
        kind: 'DAILY',
        photoDate: new Date('2026-12-02'),
        photoUrl: 'photos/daily-admin.png',
        lat: 23.03,
        lng: 72.56,
        accuracyMeters: 10,
        capturedAt: new Date(),
        status: DAILY_PHOTO_STATUS.SUBMITTED,
      },
    });
    dailyPhotoId = photo.id;

    await prisma.assignmentDay.create({
      data: {
        assignmentId,
        date: new Date('2026-12-02'),
        status: 'PENDING',
        verifiedPhotoId: dailyPhotoId,
      },
    });

    await prisma.assignmentDay.create({
      data: {
        assignmentId,
        date: new Date('2026-12-03'),
        status: 'PENDING',
      },
    });

    // 10. Seed Dispute for admin disputes queue
    const dispute = await prisma.dispute.create({
      data: {
        assignmentId,
        raisedByUserId: driverUserId,
        role: ROLES.DRIVER,
        raisedByRole: ROLES.DRIVER,
        againstParty: 'PLATFORM',
        reason: DISPUTE_REASONS.PAYMENT_ISSUE,
        details: 'Payment settlement clarification needed for day 2',
        status: 'OPEN',
      },
    });
    disputeId = dispute.id;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await disconnectRedis();
    await prisma.$disconnect();
  });

  // ===========================================================================
  // 1. PING & STEP-UP AUTHENTICATION FLOW
  // ===========================================================================
  describe('1. Ping & Step-up Authentication', () => {
    it('GET /api/v1/admin/ping returns 200 with role SUPER_ADMIN', async () => {
      const res = await request(app)
        .get('/api/v1/admin/ping')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe(ROLES.SUPER_ADMIN);
    });

    it('POST /api/v1/admin/step-up/verify accepts password in test mode and validates session', async () => {
      const res = await request(app)
        .post('/api/v1/admin/step-up/verify')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ password: 'SuperAdminStrongPass#2026!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.stepUpVerified).toBe(true);
      expect(res.body.data.verifiedAt).toBeDefined();
    });

    it('GET /api/v1/admin/step-up/status confirms verified state', async () => {
      const res = await request(app)
        .get('/api/v1/admin/step-up/status')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.stepUpVerified).toBe(true);
    });

    it('POST /api/v1/admin/reveal reveals masked PII with step-up verification', async () => {
      const res = await request(app)
        .post('/api/v1/admin/reveal')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          entityType: 'USER',
          entityId: adminUserId,
          field: 'email',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.value).toBe('superadmin@autoposter.test');
    });
  });

  // ===========================================================================
  // 2. ADMIN TEAM MANAGEMENT
  // ===========================================================================
  describe('2. Admin Team Management', () => {
    it('GET /api/v1/admin/team lists existing administrators', async () => {
      const res = await request(app)
        .get('/api/v1/admin/team')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('POST /api/v1/admin/team creates a new moderator', async () => {
      const res = await request(app)
        .post('/api/v1/admin/team')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'moderator.test@autoposter.test',
          mobile: '+919999900002',
          role: ROLES.MODERATOR,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.admin.email).toBe('moderator.test@autoposter.test');
      expect(res.body.data.admin.role).toBe(ROLES.MODERATOR);
      expect(res.body.data.temporaryPassword).toBeDefined();

      secondaryAdminId = res.body.data.admin.id;
    });

    it('PATCH /api/v1/admin/team/:id/status updates admin status', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/team/${secondaryAdminId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: ACCOUNT_STATUS.SUSPENDED,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(ACCOUNT_STATUS.SUSPENDED);
    });

    it('PATCH /api/v1/admin/team/:id updates admin role with step-up verification', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/team/${secondaryAdminId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: ROLES.FINANCE,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe(ROLES.FINANCE);
    });
  });

  // ===========================================================================
  // 3. LOCATIONS MANAGEMENT (CITIES & ZONES)
  // ===========================================================================
  describe('3. Locations Management', () => {
    let createdCityId: string;
    let createdZoneId: string;

    it('GET /api/v1/admin/locations/cities lists all cities', async () => {
      const res = await request(app)
        .get('/api/v1/admin/locations/cities')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /api/v1/admin/locations/cities creates a new city', async () => {
      const res = await request(app)
        .post('/api/v1/admin/locations/cities')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Vadodara Test',
          state: 'Gujarat',
          country: 'IN',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Vadodara Test');
      createdCityId = res.body.data.id;
    });

    it('PUT /api/v1/admin/locations/cities/:id updates city details', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/locations/cities/${createdCityId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Vadodara Updated',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Vadodara Updated');
    });

    it('POST /api/v1/admin/locations/zones creates a new zone', async () => {
      const res = await request(app)
        .post('/api/v1/admin/locations/zones')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cityId: createdCityId,
          name: 'Alkapuri Hub',
          pinCodes: ['390007'],
          centerLat: 22.31,
          centerLng: 73.18,
          radiusMeters: 4500,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Alkapuri Hub');
      createdZoneId = res.body.data.id;
    });

    it('GET /api/v1/admin/locations/zones lists zones for city', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/locations/zones?cityId=${createdCityId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('PUT /api/v1/admin/locations/zones/:id updates zone details', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/locations/zones/${createdZoneId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          radiusMeters: 6000,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.radiusMeters).toBe(6000);
    });
  });

  // ===========================================================================
  // 4. MODERATION QUEUES (CAMPAIGNS, INSTALLATIONS, DAILY PHOTOS)
  // ===========================================================================
  describe('4. Moderation Queues', () => {
    it('GET /api/v1/admin/campaigns/review-queue lists submitted campaigns', async () => {
      const res = await request(app)
        .get('/api/v1/admin/campaigns/review-queue')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /api/v1/admin/campaigns/:id/claim claims a campaign for review', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/campaigns/${campaignId}/claim`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assignedToId).toBe(adminUserId);
    });

    it('POST /api/v1/admin/campaigns/:id/release releases a claimed campaign', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/campaigns/${campaignId}/release`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assignedToId).toBeNull();
    });

    it('GET /api/v1/admin/campaigns/:id returns campaign details for admin', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/campaigns/${campaignId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.campaign.id).toBe(campaignId);
    });

    it('POST /api/v1/admin/campaigns/:id/decision approves the campaign', async () => {
      // Re-claim before deciding
      await request(app)
        .post(`/api/v1/admin/campaigns/${campaignId}/claim`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .post(`/api/v1/admin/campaigns/${campaignId}/decision`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          decision: 'APPROVED',
          note: 'Poster complies with all platform guidelines',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(CAMPAIGN_STATUS.AWAITING_PAYMENT);
    });

    it('GET /api/v1/admin/installations/review-queue lists submitted installations', async () => {
      const res = await request(app)
        .get('/api/v1/admin/installations/review-queue')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /api/v1/admin/installations/:id/claim claims installation', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/installations/${assignmentId}/claim`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/v1/admin/installations/:id/release releases installation claim', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/installations/${assignmentId}/release`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/v1/admin/installations/:id/decision approves the installation', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/installations/${assignmentId}/decision`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          decision: 'APPROVED',
          note: 'Installation photo verified on auto rear',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(ASSIGNMENT_STATUS.INSTALL_APPROVED);
    });

    it('GET /api/v1/admin/daily-photos/queue lists daily photos pending review', async () => {
      const res = await request(app)
        .get('/api/v1/admin/daily-photos/queue')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /api/v1/admin/daily-photos/:id/claim claims a daily photo', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/daily-photos/${dailyPhotoId}/claim`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/v1/admin/daily-photos/:id returns daily photo inspection details', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/daily-photos/${dailyPhotoId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.photo.photoId).toBe(dailyPhotoId);
    });

    it('POST /api/v1/admin/daily-photos/:id/review approves daily photo', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/daily-photos/${dailyPhotoId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          decision: 'APPROVE',
          note: 'Clean photo with visible number plate',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(DAILY_PHOTO_STATUS.VERIFIED);
    });

    it('POST /api/v1/admin/assignments/:id/days/:date/excuse excuses a missed or disputed day', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/assignments/${assignmentId}/days/2026-12-03/excuse`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Severe weather / heavy rain alert',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/v1/admin/fraud/overview returns anti-fraud telemetry', async () => {
      const res = await request(app)
        .get('/api/v1/admin/fraud/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('GET /api/v1/admin/drivers/:id/trust returns driver trust score', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/drivers/${driverUserId}/trust`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.trustTier).toBeDefined();
      expect(res.body.data.driverId).toBe(driverUserId);
    });
  });

  // ===========================================================================
  // 5. DISCIPLINE & DISPUTES
  // ===========================================================================
  describe('5. Discipline & Disputes', () => {
    it('POST /api/v1/admin/strikes issues a strike to a driver', async () => {
      const res = await request(app)
        .post('/api/v1/admin/strikes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          driverId: driverUserId,
          assignmentId,
          reason: STRIKE_REASONS.OTHER,
          note: 'Warning note for verification testing',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.driverId).toBe(driverUserId);
      strikeId = res.body.data.id;
    });

    it('GET /api/v1/admin/strikes lists strikes', async () => {
      const res = await request(app)
        .get('/api/v1/admin/strikes')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('POST /api/v1/admin/strikes/:id/revoke revokes an issued strike', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/strikes/${strikeId}/revoke`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Corrected administrative mistake',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.revokedAt).toBeDefined();
    });

    it('GET /api/v1/admin/bans lists driver bans', async () => {
      const res = await request(app)
        .get('/api/v1/admin/bans')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /api/v1/admin/drivers/:driverId/discipline returns driver discipline profile', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/drivers/${driverUserId}/discipline`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.activeStrikesCount).toBeDefined();
      expect(Array.isArray(res.body.data.strikes)).toBe(true);
    });

    it('GET /api/v1/admin/disputes lists open disputes', async () => {
      const res = await request(app)
        .get('/api/v1/admin/disputes')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /api/v1/admin/disputes/:id returns dispute detail', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/disputes/${disputeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(disputeId);
    });

    it('POST /api/v1/admin/disputes/:id/claim claims a dispute', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/disputes/${disputeId}/claim`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assignedToId).toBe(adminUserId);
    });

    it('POST /api/v1/admin/disputes/:id/release releases dispute claim', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/disputes/${disputeId}/release`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assignedToId).toBeNull();
    });

    it('POST /api/v1/admin/disputes/:id/messages adds an admin dispute message', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/disputes/${disputeId}/messages`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          body: 'Reviewing your logs with the engineering team.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.body).toBe('Reviewing your logs with the engineering team.');
    });

    it('POST /api/v1/admin/disputes/:id/decision resolves the dispute', async () => {
      // Must be claimed (UNDER_REVIEW) before executing decision
      await request(app)
        .post(`/api/v1/admin/disputes/${disputeId}/claim`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .post(`/api/v1/admin/disputes/${disputeId}/decision`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          resolutionType: 'UPHELD_FOR_DRIVER',
          decisionText: 'Matter resolved in driver favor following policy.',
          effects: [],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(DISPUTE_STATUS.RESOLVED);
    });
  });

  // ===========================================================================
  // 6. WORK QUEUES, SEARCH, ANALYTICS & REPORTS
  // ===========================================================================
  describe('6. Work Queues, Search, Analytics & Reports', () => {
    it('GET /api/v1/admin/work-queues/summary returns aggregated queue counts', async () => {
      const res = await request(app)
        .get('/api/v1/admin/work-queues/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('GET /api/v1/admin/my-work returns items assigned to the current admin', async () => {
      const res = await request(app)
        .get('/api/v1/admin/my-work')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('GET /api/v1/admin/team/workload returns team allocation workload', async () => {
      const res = await request(app)
        .get('/api/v1/admin/team/workload')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /api/v1/admin/search returns omnisearch matches', async () => {
      const res = await request(app)
        .get('/api/v1/admin/search?q=Ahmedabad')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('GET /api/v1/admin/analytics/overview returns analytics metrics', async () => {
      const res = await request(app)
        .get('/api/v1/admin/analytics/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.kpis.totalDrivers).toBeDefined();
      expect(res.body.data.kpis.liveCampaigns).toBeDefined();
    });

    it('POST /api/v1/admin/reports/export triggers an export job', async () => {
      const res = await request(app)
        .post('/api/v1/admin/reports/export')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reportKey: 'DRIVERS',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.exportId).toBeDefined();
      expect(res.body.data.status).toBeDefined();
    });

    it('GET /api/v1/admin/reports/exports lists export history', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reports/exports')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ===========================================================================
  // 7. ENTITY 360 & SAVED VIEWS
  // ===========================================================================
  describe('7. Entity 360 & Saved Views', () => {
    it('GET /api/v1/admin/drivers lists all drivers with filters', async () => {
      const res = await request(app)
        .get('/api/v1/admin/drivers')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.drivers)).toBe(true);
      expect(res.body.data.drivers.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/v1/admin/companies lists all companies with filters', async () => {
      const res = await request(app)
        .get('/api/v1/admin/companies')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.companies)).toBe(true);
      expect(res.body.data.companies.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/v1/admin/drivers/:id/overview returns comprehensive driver 360 view', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/drivers/${driverProfileId}/overview`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.profile.id).toBe(driverProfileId);
    });

    it('GET /api/v1/admin/companies/:id/overview returns comprehensive company 360 view', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/companies/${companyProfileId}/overview`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.profile.id).toBe(companyProfileId);
    });

    it('PATCH /api/v1/admin/drivers/:id/verify verifies driver', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/drivers/${driverProfileId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('PATCH /api/v1/admin/companies/:id/verify verifies company', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/companies/${companyProfileId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/v1/admin/audit-logs returns platform audit trail', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('POST /api/v1/admin/saved-views creates a saved filter view', async () => {
      const res = await request(app)
        .post('/api/v1/admin/saved-views')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          pageKey: 'drivers',
          name: 'Ahmedabad Verified Drivers',
          filters: { cityId, kycStatus: 'APPROVED' },
          isDefault: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Ahmedabad Verified Drivers');
      savedViewId = res.body.data.id;
    });

    it('GET /api/v1/admin/saved-views lists saved views', async () => {
      const res = await request(app)
        .get('/api/v1/admin/saved-views?pageKey=drivers')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('PUT /api/v1/admin/saved-views/:id updates a saved view', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/saved-views/${savedViewId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Filter View',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Updated Filter View');
    });

    it('DELETE /api/v1/admin/saved-views/:id deletes a saved view', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/saved-views/${savedViewId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ===========================================================================
  // 8. SETTINGS, ROLES, CONTENT & SYSTEM
  // ===========================================================================
  describe('8. Settings, Roles, Content & System', () => {
    it('GET /api/v1/admin/settings lists grouped settings', async () => {
      const res = await request(app)
        .get('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('POST /api/v1/admin/settings/request-change submits a setting change request for sensitive keys', async () => {
      const res = await request(app)
        .post('/api/v1/admin/settings/request-change')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          key: SETTING_KEYS.COMMISSION_RATE_BPS,
          value: 1500,
          reason: 'Adjusting standard commission to 15% for upcoming festival pilot',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.requiresApproval).toBe(true);
      expect(res.body.data.requestId).toBeDefined();
    });

    it('GET /api/v1/admin/settings/change-requests lists pending change requests', async () => {
      const res = await request(app)
        .get('/api/v1/admin/settings/change-requests')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/v1/admin/roles/matrix returns roles and permissions matrix', async () => {
      const res = await request(app)
        .get('/api/v1/admin/roles/matrix')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('PUT /api/v1/admin/roles/matrix updates role permissions with step-up verification', async () => {
      const res = await request(app)
        .put('/api/v1/admin/roles/matrix')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: ROLES.MODERATOR,
          permissionKeys: ['campaign.view', 'campaign.review', 'photo.approve'],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/v1/admin/legal lists legal documents', async () => {
      const res = await request(app)
        .get('/api/v1/admin/legal')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /api/v1/admin/legal creates a draft legal document', async () => {
      const res = await request(app)
        .post('/api/v1/admin/legal')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: LEGAL_DOCUMENT_TYPES.TERMS,
          language: 'en',
          title: 'Pilot Terms of Service v1.0',
          bodyMarkdown: 'These are the official terms of service for auto poster platform pilot testing.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Pilot Terms of Service v1.0');
    });

    it('POST /api/v1/admin/help creates a help article', async () => {
      const res = await request(app)
        .post('/api/v1/admin/help')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          category: 'driver-guide',
          language: 'en',
          title: 'How to upload daily photos',
          bodyMarkdown: 'Position the camera 2 meters away from your auto rear and ensure number plate is clear.',
          published: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('How to upload daily photos');
      helpArticleId = res.body.data.id;
    });

    it('GET /api/v1/admin/help lists help articles', async () => {
      const res = await request(app)
        .get('/api/v1/admin/help')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /api/v1/admin/help/:id returns help article', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/help/${helpArticleId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(helpArticleId);
    });

    it('PUT /api/v1/admin/help/:id updates help article', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/help/${helpArticleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'How to upload daily photos (Updated)',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('How to upload daily photos (Updated)');
    });

    it('DELETE /api/v1/admin/help/:id deletes help article', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/help/${helpArticleId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/v1/admin/system/health returns platform systems health check', async () => {
      const res = await request(app)
        .get('/api/v1/admin/system/health')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBeDefined();
    });

    it('GET /api/v1/admin/system/jobs lists scheduled queue runs', async () => {
      const res = await request(app)
        .get('/api/v1/admin/system/jobs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });
  });

  // ===========================================================================
  // 9. LAUNCH READINESS & PILOT OPERATIONS
  // ===========================================================================
  describe('9. Launch Readiness & Pilot Operations', () => {
    it('GET /api/v1/admin/launch/readiness returns launch checklist status', async () => {
      const res = await request(app)
        .get('/api/v1/admin/launch/readiness')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.overallStatus).toBeDefined();
    });

    it('GET /api/v1/admin/launch/sign-offs returns pilot sign-offs state', async () => {
      const res = await request(app)
        .get('/api/v1/admin/launch/sign-offs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /api/v1/admin/pilot/command-center returns pilot live overview', async () => {
      const res = await request(app)
        .get('/api/v1/admin/pilot/command-center')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('GET /api/v1/admin/pilot/anomalies returns anomaly findings list', async () => {
      const res = await request(app)
        .get('/api/v1/admin/pilot/anomalies')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('GET /api/v1/admin/pilot/quality-review returns second-look inspection items', async () => {
      const res = await request(app)
        .get('/api/v1/admin/pilot/quality-review')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('GET /api/v1/admin/pilot/waitlist returns waitlist entries', async () => {
      const res = await request(app)
        .get('/api/v1/admin/pilot/waitlist')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('POST /api/v1/admin/pilot/invite-codes creates a driver pilot invite code', async () => {
      const res = await request(app)
        .post('/api/v1/admin/pilot/invite-codes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: ROLES.DRIVER,
          cityId,
          maxUses: 10,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.code).toBeDefined();
      expect(res.body.data.role).toBe(ROLES.DRIVER);
      inviteCodeId = res.body.data.id;
    });

    it('GET /api/v1/admin/pilot/invite-codes lists active invite codes', async () => {
      const res = await request(app)
        .get('/api/v1/admin/pilot/invite-codes')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    });

    it('DELETE /api/v1/admin/pilot/invite-codes/:id revokes an invite code', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/pilot/invite-codes/${inviteCodeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/v1/admin/pilot/print-shops registers an authorized print shop', async () => {
      const res = await request(app)
        .post('/api/v1/admin/pilot/print-shops')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Shree Sai Digital Printers',
          cityName: 'Ahmedabad Admin',
          address: 'Shop 4, Stadium Circle, Navrangpura',
          latitude: 23.037,
          longitude: 72.564,
          phone: '+919876543210',
          operatingHours: '9:00 AM - 9:00 PM',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Shree Sai Digital Printers');
      printShopId = res.body.data.id;
    });

    it('GET /api/v1/admin/pilot/print-shops lists print shops', async () => {
      const res = await request(app)
        .get('/api/v1/admin/pilot/print-shops')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('PATCH /api/v1/admin/pilot/print-shops/:id updates print shop details', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/pilot/print-shops/${printShopId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          operatingHours: '8:30 AM - 9:30 PM',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.operatingHours).toBe('8:30 AM - 9:30 PM');
    });

    it('DELETE /api/v1/admin/pilot/print-shops/:id deletes print shop', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/pilot/print-shops/${printShopId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
