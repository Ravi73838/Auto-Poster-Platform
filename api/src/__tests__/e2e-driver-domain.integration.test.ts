import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { createApp } from '../app.js';
import { prisma } from '../shared/db/index.js';
import { disconnectRedis } from '../shared/redis/index.js';
import { TokenService } from '../modules/auth/token.service.js';
import { storageProvider } from '../integrations/storage/index.js';
import {
  ROLES,
  ACCOUNT_STATUS,
  CAMPAIGN_STATUS,
  ASSIGNMENT_STATUS,
  DOCUMENT_TYPES,
  PAYOUT_METHODS,
  CONSENT_TYPES,
  DISPUTE_REASONS,
  FILE_PURPOSES,
} from '@ap/shared-constants';

describe('Suite 2: Driver Domain Flow Endpoints', () => {
  const app = createApp();

  // Test state
  let cityId: string;
  let zoneId: string;
  let companyUserId: string;

  // Driver 1: Onboarding Driver (PENDING)
  let onboardingDriverId: string;
  let onboardingDriverToken: string;
  let uploadedKycFileId: string;
  let uploadedDocId: string;

  // Driver 2: Fully Approved Driver with Vehicle
  let activeDriverId: string;
  let activeDriverToken: string;
  let activeVehicleId: string;

  // Campaigns & Assignments
  let liveCampaignId: string;
  let assignedCampaignId: string;
  let installingAssignmentId: string;
  let runningAssignmentId: string;
  let installPhotoFileId: string;
  let dailyPhotoFileId: string;
  let disputeEvidenceFileId: string;
  let createdDisputeId: string;

  beforeAll(async () => {
    // 0. Mock storage operations with a valid 400x400 PNG so image sanity checks pass
    const VALID_PNG_BUFFER = await sharp({
      create: {
        width: 400,
        height: 400,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    vi.spyOn(storageProvider, 'getObject').mockResolvedValue(VALID_PNG_BUFFER);
    vi.spyOn(storageProvider, 'putObject').mockResolvedValue(undefined as any);

    // 1. Clean test tables
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "dispute_messages",
        "disputes",
        "strikes",
        "photos",
        "assignment_days",
        "assignment_settlements",
        "assignments",
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

    // 2. Seed City & Zone
    const city = await prisma.city.upsert({
      where: {
        name_state: {
          name: 'Ahmedabad',
          state: 'Gujarat',
        },
      },
      create: {
        name: 'Ahmedabad',
        state: 'Gujarat',
        country: 'IN',
        isActive: true,
      },
      update: {
        isActive: true,
      },
    });
    cityId = city.id;

    const zone = await prisma.zone.create({
      data: {
        cityId: city.id,
        name: 'Navrangpura',
        centerLat: 23.0365,
        centerLng: 72.5611,
        radiusMeters: 5000,
        isActive: true,
      },
    });
    zoneId = zone.id;

    // 3. Seed Company user & profile
    const companyUser = await prisma.user.create({
      data: {
        role: ROLES.COMPANY,
        status: ACCOUNT_STATUS.APPROVED,
        mobile: '+919900011111',
        email: 'company@drivertest.com',
        preferredLanguage: 'en',
      },
    });
    companyUserId = companyUser.id;

    await prisma.companyProfile.create({
      data: {
        userId: companyUser.id,
        cityId: city.id,
        companyName: 'Driver Test Brands Ltd',
        contactPersonName: 'Anil Ambani',
        contactPersonPhone: '+919900011111',
        isVerified: true,
      },
    });

    // 4. Seed Onboarding Driver (PENDING status)
    const onboardingUser = await prisma.user.create({
      data: {
        role: ROLES.DRIVER,
        status: ACCOUNT_STATUS.PENDING,
        mobile: '+919876500001',
        preferredLanguage: 'en',
      },
    });
    onboardingDriverId = onboardingUser.id;

    const onboardingSession = await TokenService.createSession({
      userId: onboardingUser.id,
      platform: 'ANDROID',
    });
    onboardingDriverToken = onboardingSession.accessToken;

    // Seed confirmed uploaded file for KYC document
    const kycFile = await prisma.uploadedFile.create({
      data: {
        ownerUserId: onboardingUser.id,
        fileKey: 'driver/kyc/dl_sample.png',
        purpose: FILE_PURPOSES.KYC_DOCUMENT,
        mimeType: 'image/png',
        sizeBytes: 2048,
        status: 'CONFIRMED',
      },
    });
    uploadedKycFileId = kycFile.id;

    // 5. Seed Active Approved Driver with Vehicle
    const activeVehicle = await prisma.vehicle.create({
      data: {
        registrationNumber: 'GJ01XY9999',
        vehicleType: 'AUTO_RICKSHAW',
        ownerName: 'Babubhai Auto',
        ownerMobile: '+919876500002',
        isVerified: true,
      },
    });
    activeVehicleId = activeVehicle.id;

    const activeUser = await prisma.user.create({
      data: {
        role: ROLES.DRIVER,
        status: ACCOUNT_STATUS.APPROVED,
        mobile: '+919876500002',
        preferredLanguage: 'en',
      },
    });
    activeDriverId = activeUser.id;

    const activeProfile = await prisma.driverProfile.create({
      data: {
        userId: activeUser.id,
        fullName: 'Babubhai Auto Driver',
        cityId: city.id,
        currentVehicleId: activeVehicle.id,
        payoutMethod: PAYOUT_METHODS.UPI,
        isAvailable: true,
      },
    });

    await prisma.driverZone.create({
      data: {
        driverId: activeProfile.id,
        zoneId: zone.id,
        isPrimary: true,
      },
    });

    const activeSession = await TokenService.createSession({
      userId: activeUser.id,
      platform: 'ANDROID',
    });
    activeDriverToken = activeSession.accessToken;

    // Seed campaign poster file
    const posterFile = await prisma.uploadedFile.create({
      data: {
        ownerUserId: companyUser.id,
        fileKey: 'campaigns/posters/poster1.png',
        purpose: FILE_PURPOSES.CAMPAIGN_POSTER,
        mimeType: 'image/png',
        sizeBytes: 1048576,
        status: 'CONFIRMED',
      },
    });

    // 6. Seed a Live Campaign for browsing & selection
    const today = new Date();
    const startDate = new Date(today.getTime() - 2 * 86400 * 1000); // 2 days ago
    const endDate = new Date(today.getTime() + 28 * 86400 * 1000); // 28 days later

    const liveCampaign = await prisma.campaign.create({
      data: {
        companyId: companyUser.id,
        cityId: city.id,
        posterFileId: posterFile.id,
        title: 'Ahmedabad Winter Mega Fest',
        description: 'Festival promotion across Gujarat',
        targetAutoCount: 10,
        enrolledCount: 0,
        startDate,
        endDate,
        dailyRentPaise: 15000,
        printingAllowancePaise: 50000,
        totalBudgetPaise: 5000000n,
        platformFeePaise: 500000n,
        gstAmountPaise: 990000n,
        totalChargedPaise: 6490000n,
        status: CAMPAIGN_STATUS.LIVE,
      },
    });
    liveCampaignId = liveCampaign.id;

    await prisma.campaignZone.create({
      data: {
        campaignId: liveCampaign.id,
        zoneId: zone.id,
      },
    });

    // 7. Seed another Campaign + Assignments for Installation & Daily Photo testing
    const assignedCampaign = await prisma.campaign.create({
      data: {
        companyId: companyUser.id,
        cityId: city.id,
        posterFileId: posterFile.id,
        title: 'Ahmedabad Metro Launch',
        targetAutoCount: 5,
        enrolledCount: 2,
        startDate,
        endDate,
        dailyRentPaise: 20000,
        printingAllowancePaise: 50000,
        totalBudgetPaise: 4000000n,
        platformFeePaise: 400000n,
        gstAmountPaise: 792000n,
        totalChargedPaise: 5192000n,
        status: CAMPAIGN_STATUS.RUNNING,
      },
    });
    assignedCampaignId = assignedCampaign.id;

    // Vehicle for assignment 1
    const v1 = await prisma.vehicle.create({
      data: {
        registrationNumber: 'GJ01AB1111',
        vehicleType: 'AUTO_RICKSHAW',
        isVerified: true,
      },
    });

    const installingAssignment = await prisma.assignment.create({
      data: {
        campaignId: assignedCampaign.id,
        driverId: activeUser.id,
        vehicleId: v1.id,
        status: ASSIGNMENT_STATUS.INSTALLING,
        reservedAt: startDate,
        expiresAt: endDate,
        totalDays: 30,
      },
    });
    installingAssignmentId = installingAssignment.id;

    // Vehicle for assignment 2 (RUNNING)
    const v2 = await prisma.vehicle.create({
      data: {
        registrationNumber: 'GJ01AB2222',
        vehicleType: 'AUTO_RICKSHAW',
        isVerified: true,
      },
    });

    const runningAssignment = await prisma.assignment.create({
      data: {
        campaignId: liveCampaign.id,
        driverId: activeUser.id,
        vehicleId: v2.id,
        status: ASSIGNMENT_STATUS.RUNNING,
        reservedAt: startDate,
        expiresAt: endDate,
        startedAt: startDate,
        totalDays: 30,
        verifiedDays: 2,
      },
    });
    runningAssignmentId = runningAssignment.id;

    // Seed Settlement for runningAssignment
    await prisma.assignmentSettlement.create({
      data: {
        assignmentId: runningAssignment.id,
        campaignId: liveCampaign.id,
        driverId: activeUser.id,
        status: 'PENDING',
        totalDays: 30,
        verifiedDays: 2,
        missedDays: 0,
        graceDaysUsed: 0,
        payableDays: 2,
        dailyRentPaise: 20000n,
        rentPayablePaise: 40000n,
        printingAllowancePaise: 50000n,
        companyRefundPaise: 0n,
        commissionPaise: 5000n,
        gstPaise: 900n,
        totalAmountPaise: 90000n,
      },
    });

    // Seed files for installation, daily photo and dispute evidence
    const installFile = await prisma.uploadedFile.create({
      data: {
        ownerUserId: activeUser.id,
        fileKey: 'driver/install/photo1.png',
        purpose: FILE_PURPOSES.INSTALLATION_PHOTO,
        mimeType: 'image/png',
        sizeBytes: 10240,
        status: 'CONFIRMED',
      },
    });
    installPhotoFileId = installFile.id;

    const dailyFile = await prisma.uploadedFile.create({
      data: {
        ownerUserId: activeUser.id,
        fileKey: 'driver/daily/photo1.png',
        purpose: FILE_PURPOSES.DAILY_PHOTO,
        mimeType: 'image/png',
        sizeBytes: 10240,
        status: 'CONFIRMED',
      },
    });
    dailyPhotoFileId = dailyFile.id;

    const disputeFile = await prisma.uploadedFile.create({
      data: {
        ownerUserId: activeUser.id,
        fileKey: 'driver/dispute/evidence.png',
        purpose: FILE_PURPOSES.DISPUTE_EVIDENCE,
        mimeType: 'image/png',
        sizeBytes: 10240,
        status: 'CONFIRMED',
      },
    });
    disputeEvidenceFileId = disputeFile.id;
  }, 30000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.$disconnect();
    await disconnectRedis();
  }, 30000);

  // --------------------------------------------------------------------------
  // 1. Base Driver Guards & Metadata
  // --------------------------------------------------------------------------
  describe('Base Driver Guards & Metadata', () => {
    it('GET /api/v1/driver/ping verifies driver authentication', async () => {
      const res = await request(app)
        .get('/api/v1/driver/ping')
        .set('Authorization', `Bearer ${onboardingDriverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('pong');
      expect(res.body.data.role).toBe(ROLES.DRIVER);
    });

    it('rejects unauthenticated requests to driver endpoints', async () => {
      const res = await request(app).get('/api/v1/driver/home');
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/driver/capture-rules returns photo guidelines', async () => {
      const res = await request(app)
        .get('/api/v1/driver/capture-rules')
        .set('Authorization', `Bearer ${onboardingDriverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('GET /api/v1/driver/home returns home dashboard data', async () => {
      const res = await request(app)
        .get('/api/v1/driver/home')
        .set('Authorization', `Bearer ${onboardingDriverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // 2. Onboarding & KYC Steps Flow
  // --------------------------------------------------------------------------
  describe('Driver Onboarding & KYC Flow', () => {
    it('GET /api/v1/driver/onboarding returns initial onboarding state', async () => {
      const res = await request(app)
        .get('/api/v1/driver/onboarding')
        .set('Authorization', `Bearer ${onboardingDriverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.canSubmit).toBe(false);
    });

    it('PUT /api/v1/driver/profile updates personal details', async () => {
      const res = await request(app)
        .put('/api/v1/driver/profile')
        .set('Authorization', `Bearer ${onboardingDriverToken}`)
        .send({
          fullName: 'Mohanlal Rickshawwala',
          cityId,
          primaryZoneId: zoneId,
          extraZoneIds: [],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('PUT /api/v1/driver/vehicle registers driver auto-rickshaw', async () => {
      const res = await request(app)
        .put('/api/v1/driver/vehicle')
        .set('Authorization', `Bearer ${onboardingDriverToken}`)
        .send({
          registrationNumber: 'GJ01MN1234',
          isVehicleOwner: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/v1/driver/documents attaches KYC document', async () => {
      const res = await request(app)
        .post('/api/v1/driver/documents')
        .set('Authorization', `Bearer ${onboardingDriverToken}`)
        .send({
          type: DOCUMENT_TYPES.DRIVING_LICENCE,
          uploadedFileId: uploadedKycFileId,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const doc = await prisma.document.findFirst({
        where: { userId: onboardingDriverId, documentType: DOCUMENT_TYPES.DRIVING_LICENCE },
      });
      expect(doc).not.toBeNull();
      uploadedDocId = doc!.id;
    });

    it('DELETE /api/v1/driver/documents/:id removes attached document', async () => {
      const res = await request(app)
        .delete(`/api/v1/driver/documents/${uploadedDocId}`)
        .set('Authorization', `Bearer ${onboardingDriverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Re-attach document for completing KYC submission flow
      await request(app)
        .post('/api/v1/driver/documents')
        .set('Authorization', `Bearer ${onboardingDriverToken}`)
        .send({
          type: DOCUMENT_TYPES.DRIVING_LICENCE,
          uploadedFileId: uploadedKycFileId,
        });
    });

    it('PUT /api/v1/driver/payout-details configures UPI payout', async () => {
      const res = await request(app)
        .put('/api/v1/driver/payout-details')
        .set('Authorization', `Bearer ${onboardingDriverToken}`)
        .send({
          method: PAYOUT_METHODS.UPI,
          upiId: 'mohanlal@okaxis',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/v1/driver/consents records required platform consents', async () => {
      const res = await request(app)
        .post('/api/v1/driver/consents')
        .set('Authorization', `Bearer ${onboardingDriverToken}`)
        .send({
          consents: [
            { type: CONSENT_TYPES.TERMS, version: '1.0' },
            { type: CONSENT_TYPES.PRIVACY, version: '1.0' },
            { type: CONSENT_TYPES.LOCATION, version: '1.0' },
            { type: CONSENT_TYPES.CAMERA, version: '1.0' },
            { type: CONSENT_TYPES.POSTER_POLICY, version: '1.0' },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/v1/driver/kyc returns current onboarding & KYC status', async () => {
      const res = await request(app)
        .get('/api/v1/driver/kyc')
        .set('Authorization', `Bearer ${onboardingDriverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.steps).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // 3. Campaign Discovery & Selection
  // --------------------------------------------------------------------------
  describe('Campaign Discovery & Selection', () => {
    it('GET /api/v1/driver/campaigns lists available campaigns in driver city', async () => {
      const res = await request(app)
        .get('/api/v1/driver/campaigns')
        .set('Authorization', `Bearer ${activeDriverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /api/v1/driver/campaigns/:id returns detailed campaign specifications', async () => {
      const res = await request(app)
        .get(`/api/v1/driver/campaigns/${liveCampaignId}`)
        .set('Authorization', `Bearer ${activeDriverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(liveCampaignId);
      expect(res.body.data.title).toBe('Ahmedabad Winter Mega Fest');
    });

    it('rejects campaign selection when driver has active assignment', async () => {
      const res = await request(app)
        .post(`/api/v1/driver/campaigns/${liveCampaignId}/select`)
        .set('Authorization', `Bearer ${activeDriverToken}`)
        .send({});

      // Active driver already has active assignments seeded in beforeAll
      expect(res.status).toBe(409);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Assignments & Installation Flow
  // --------------------------------------------------------------------------
  describe('Assignments & Installation Flow', () => {
    it('GET /api/v1/driver/assignments lists all driver assignments', async () => {
      const res = await request(app)
        .get('/api/v1/driver/assignments')
        .set('Authorization', `Bearer ${activeDriverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('GET /api/v1/driver/assignments/:id returns assignment details', async () => {
      const res = await request(app)
        .get(`/api/v1/driver/assignments/${installingAssignmentId}`)
        .set('Authorization', `Bearer ${activeDriverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assignment.id).toBe(installingAssignmentId);
    });

    it('GET /api/v1/driver/assignments/:id/print-guide returns poster guide', async () => {
      const res = await request(app)
        .get(`/api/v1/driver/assignments/${installingAssignmentId}/print-guide`)
        .set('Authorization', `Bearer ${activeDriverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('POST /api/v1/driver/assignments/:id/installation submits installation proof', async () => {
      const res = await request(app)
        .post(`/api/v1/driver/assignments/${installingAssignmentId}/installation`)
        .set('Authorization', `Bearer ${activeDriverToken}`)
        .send({
          uploadedFileId: installPhotoFileId,
          latitude: 23.0365,
          longitude: 72.5611,
          accuracyMeters: 10,
          capturedAt: new Date().toISOString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.photo).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // 5. Daily Photo Proof & Calendar
  // --------------------------------------------------------------------------
  describe('Daily Photo Proof & Calendar', () => {
    it('GET /api/v1/driver/assignments/:id/today returns today submission status', async () => {
      const res = await request(app)
        .get(`/api/v1/driver/assignments/${runningAssignmentId}/today`)
        .set('Authorization', `Bearer ${activeDriverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('POST /api/v1/driver/assignments/:id/daily-photos submits daily proof', async () => {
      const res = await request(app)
        .post(`/api/v1/driver/assignments/${runningAssignmentId}/daily-photos`)
        .set('Authorization', `Bearer ${activeDriverToken}`)
        .send({
          uploadedFileId: dailyPhotoFileId,
          latitude: 23.0365,
          longitude: 72.5611,
          accuracyMeters: 12,
          capturedAt: new Date().toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.photoId).toBeDefined();
    });

    it('GET /api/v1/driver/assignments/:id/days returns assignment calendar summary', async () => {
      const res = await request(app)
        .get(`/api/v1/driver/assignments/${runningAssignmentId}/days`)
        .set('Authorization', `Bearer ${activeDriverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('GET /api/v1/driver/assignments/:id/daily-photos lists submitted daily photos', async () => {
      const res = await request(app)
        .get(`/api/v1/driver/assignments/${runningAssignmentId}/daily-photos`)
        .set('Authorization', `Bearer ${activeDriverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Wallet, Settlements & Withdrawals
  // --------------------------------------------------------------------------
  describe('Wallet, Settlements & Withdrawals', () => {
    it('GET /api/v1/driver/wallet returns driver balance and earnings', async () => {
      const res = await request(app)
        .get('/api/v1/driver/wallet')
        .set('Authorization', `Bearer ${activeDriverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.balancePaise).toBeDefined();
    });

    it('GET /api/v1/driver/wallet/statement returns ledger statement', async () => {
      const res = await request(app)
        .get('/api/v1/driver/wallet/statement')
        .set('Authorization', `Bearer ${activeDriverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /api/v1/driver/payouts lists past payout requests', async () => {
      const res = await request(app)
        .get('/api/v1/driver/payouts')
        .set('Authorization', `Bearer ${activeDriverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /api/v1/driver/withdrawals validates minimum amount rule', async () => {
      const res = await request(app)
        .post('/api/v1/driver/withdrawals')
        .set('Authorization', `Bearer ${activeDriverToken}`)
        .send({
          amountPaise: '50', // Below minimum withdrawal limit
        });

      expect(res.status).toBe(400);
    });

    it('GET /api/v1/driver/assignments/:id/settlement returns settlement breakdown', async () => {
      const res = await request(app)
        .get(`/api/v1/driver/assignments/${runningAssignmentId}/settlement`)
        .set('Authorization', `Bearer ${activeDriverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assignmentId).toBe(runningAssignmentId);
      expect(res.body.data.totalDays).toBe(30);
    });
  });

  // --------------------------------------------------------------------------
  // 7. Discipline & Disputes
  // --------------------------------------------------------------------------
  describe('Discipline & Disputes', () => {
    it('GET /api/v1/driver/discipline returns strikes and bans for driver', async () => {
      const res = await request(app)
        .get('/api/v1/driver/discipline')
        .set('Authorization', `Bearer ${activeDriverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.activeStrikesCount).toBeDefined();
    });

    it('GET /api/v1/driver/discipline/rules returns platform discipline guidelines', async () => {
      const res = await request(app)
        .get('/api/v1/driver/discipline/rules')
        .set('Authorization', `Bearer ${activeDriverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.strikeLimit).toBe(3);
    });

    it('POST /api/v1/driver/disputes creates a new dispute', async () => {
      const res = await request(app)
        .post('/api/v1/driver/disputes')
        .set('Authorization', `Bearer ${activeDriverToken}`)
        .send({
          assignmentId: runningAssignmentId,
          reason: DISPUTE_REASONS.PAYMENT_ISSUE,
          description: 'Payment discrepancy on day 2 verified proof',
          evidenceUploadedFileIds: [disputeEvidenceFileId],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      createdDisputeId = res.body.data.id;
    });

    it('GET /api/v1/driver/disputes lists open driver disputes', async () => {
      const res = await request(app)
        .get('/api/v1/driver/disputes')
        .set('Authorization', `Bearer ${activeDriverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('GET /api/v1/driver/disputes/:id returns single dispute detail', async () => {
      const res = await request(app)
        .get(`/api/v1/driver/disputes/${createdDisputeId}`)
        .set('Authorization', `Bearer ${activeDriverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(createdDisputeId);
    });

    it('POST /api/v1/driver/disputes/:id/messages appends message to dispute', async () => {
      const res = await request(app)
        .post(`/api/v1/driver/disputes/${createdDisputeId}/messages`)
        .set('Authorization', `Bearer ${activeDriverToken}`)
        .send({
          body: 'Additional explanation about the dispute timeline and odometer.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
    });
  });
});
