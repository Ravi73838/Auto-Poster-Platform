import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { prisma } from '../../../shared/db/index.js';
import { createApp } from '../../../app.js';
import {
  ROLES,
  ACCOUNT_STATUS,
  CAMPAIGN_STATUS,
  ASSIGNMENT_STATUS,
  ASSIGNMENT_RELEASE_REASONS,
  INSTALL_REJECT_REASONS,
  PRINT_MATERIALS,
  VEHICLE_TYPES,
  ERROR_CODES,
  INSTALL_APPROVERS,
} from '@ap/shared-constants';
import { disconnectRedis, redisClient } from '../../../shared/redis/index.js';
import { TokenService } from '../../auth/token.service.js';
import { TimeService, addDaysIST, todayIST } from '../../../shared/time/index.js';
import { AssignmentJobsService } from '../../../jobs/assignment-jobs.service.js';
import { CampaignJobsService } from '../../../jobs/campaign-jobs.service.js';
import { storageProvider } from '../../../integrations/storage/index.js';

describe('Phase 6: Driver Assignment and Installation Flow Integration Test Suite', { timeout: 35000 }, () => {
  const app = createApp();

  let adminAccessToken: string;
  let adminUserId: string;
  let companyAccessToken: string;
  let companyUserId: string;

  let driver1AccessToken: string;
  let driver1UserId: string;
  let driver1VehicleId: string;

  let driver2AccessToken: string;
  let driver2UserId: string;
  let driver2VehicleId: string;

  let cityId: string;
  let zoneId: string;
  let posterFileId: string;
  let samplePhotoBuffer: Buffer;

  beforeAll(async () => {
    await redisClient.flushdb();

    // 1. Clean tables
    const tables = [
      'photos',
      'assignments',
      'campaign_zones',
      'campaigns',
      'uploaded_files',
      'sessions',
      'company_profiles',
      'driver_zones',
      'driver_profiles',
      'vehicles',
      'users',
      'zones',
      'cities',
      'audit_logs',
    ];

    await prisma.$executeRawUnsafe(`SET session_replication_role = 'replica';`);
    for (const table of tables) {
      await prisma.$executeRawUnsafe(`DELETE FROM "${table}";`);
    }
    await prisma.$executeRawUnsafe(`SET session_replication_role = 'origin';`);

    // 2. Create city & zone
    const city = await prisma.city.create({
      data: { name: 'Ahmedabad', state: 'Gujarat', country: 'India' },
    });
    cityId = city.id;

    const zone = await prisma.zone.create({
      data: {
        cityId,
        name: 'Navrangpura',
        centerLat: 23.0333,
        centerLng: 72.5667,
        radiusMeters: 5000,
        isActive: true,
      },
    });
    zoneId = zone.id;

    // 3. Create Admin
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin-phase6@autoposter.com',
        mobile: '+919999900001',
        role: ROLES.SUPER_ADMIN,
        status: ACCOUNT_STATUS.APPROVED,
        emailVerifiedAt: new Date(),
      },
    });
    adminUserId = adminUser.id;
    const adminSession = await prisma.session.create({
      data: {
        userId: adminUser.id,
        tokenHash: 'dummy-admin-p6-hash',
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    adminAccessToken = await TokenService.generateAccessToken(
      { id: adminUser.id, role: adminUser.role },
      adminSession.id,
    );

    // 4. Create Company
    const compUser = await prisma.user.create({
      data: {
        email: 'company-phase6@brands.com',
        mobile: '+919999900002',
        role: ROLES.COMPANY,
        status: ACCOUNT_STATUS.APPROVED,
        emailVerifiedAt: new Date(),
      },
    });
    companyUserId = compUser.id;
    await prisma.companyProfile.create({
      data: {
        userId: compUser.id,
        companyName: 'Fresh Juices India Ltd',
        contactPersonName: 'Juice Manager',
        contactPersonPhone: '+919999900002',
        cityId,
      },
    });
    const compSession = await prisma.session.create({
      data: {
        userId: compUser.id,
        tokenHash: 'dummy-comp-p6-hash',
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    companyAccessToken = await TokenService.generateAccessToken(
      { id: compUser.id, role: compUser.role },
      compSession.id,
    );

    // Poster file
    const posterUpload = await prisma.uploadedFile.create({
      data: {
        ownerUserId: compUser.id,
        fileKey: `campaigns/poster-p6-${Date.now()}.png`,
        purpose: 'CAMPAIGN_POSTER',
        mimeType: 'image/png',
        sizeBytes: 102400,
        status: 'CONFIRMED',
      },
    });
    posterFileId = posterUpload.id;

    // 5. Create Driver 1
    const d1 = await prisma.user.create({
      data: {
        mobile: '+919999900011',
        role: ROLES.DRIVER,
        status: ACCOUNT_STATUS.APPROVED,
        mobileVerifiedAt: new Date(),
      },
    });
    driver1UserId = d1.id;
    const v1 = await prisma.vehicle.create({
      data: {
        registrationNumber: 'GJ01P6001',
        vehicleType: VEHICLE_TYPES.AUTO_RICKSHAW,
        isVerified: true,
      },
    });
    driver1VehicleId = v1.id;
    await prisma.driverProfile.create({
      data: {
        userId: d1.id,
        fullName: 'Ramesh Patel',
        cityId,
        currentVehicleId: v1.id,
      },
    });
    const s1 = await prisma.session.create({
      data: {
        userId: d1.id,
        tokenHash: 'dummy-driver1-p6-hash',
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    driver1AccessToken = await TokenService.generateAccessToken(
      { id: d1.id, role: d1.role },
      s1.id,
    );

    // 6. Create Driver 2
    const d2 = await prisma.user.create({
      data: {
        mobile: '+919999900012',
        role: ROLES.DRIVER,
        status: ACCOUNT_STATUS.APPROVED,
        mobileVerifiedAt: new Date(),
      },
    });
    driver2UserId = d2.id;
    const v2 = await prisma.vehicle.create({
      data: {
        registrationNumber: 'GJ01P6002',
        vehicleType: VEHICLE_TYPES.AUTO_RICKSHAW,
        isVerified: true,
      },
    });
    driver2VehicleId = v2.id;
    await prisma.driverProfile.create({
      data: {
        userId: d2.id,
        fullName: 'Suresh Kumar',
        cityId,
        currentVehicleId: v2.id,
      },
    });
    const s2 = await prisma.session.create({
      data: {
        userId: d2.id,
        tokenHash: 'dummy-driver2-p6-hash',
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    driver2AccessToken = await TokenService.generateAccessToken(
      { id: d2.id, role: d2.role },
      s2.id,
    );

    // Sample valid image buffer for photo tests
    samplePhotoBuffer = await sharp({
      create: {
        width: 400,
        height: 400,
        channels: 3,
        background: { r: 120, g: 150, b: 200 },
      },
    })
      .png()
      .toBuffer();

    // Mock storage provider methods to avoid dependence on local MinIO
    vi.spyOn(storageProvider, 'putObject').mockResolvedValue(undefined as never);
    vi.spyOn(storageProvider, 'getObject').mockImplementation(async () => samplePhotoBuffer);
    vi.spyOn(storageProvider, 'getSignedReadUrl').mockImplementation(async (key: string) => `https://mock-storage.local/${key}`);
  }, 35000);

  afterAll(async () => {
    await prisma.$disconnect();
    await disconnectRedis();
  }, 30000);

  // --------------------------------------------------------------------------
  // Flow 1: Full Happy Path Assignment & Installation
  // --------------------------------------------------------------------------
  describe('Full Happy Path Assignment & Installation Lifecycle', () => {
    let campaignId: string;
    let assignmentId: string;
    let photoUploadId: string;

    const today = todayIST();
    const startDate = addDaysIST(today, 5);
    const endDate = addDaysIST(today, 35);

    it('1. Setup: creates a LIVE campaign ready for driver enrolment', async () => {
      const campaign = await prisma.campaign.create({
        data: {
          companyId: companyUserId,
          cityId,
          title: 'Mango Fizz Launch Campaign',
          targetAutoCount: 5,
          startDate: new Date(`${startDate}T00:00:00.000Z`),
          endDate: new Date(`${endDate}T23:59:59.999Z`),
          dailyRentPaise: 10000,
          printingAllowancePaise: 50000,
          totalBudgetPaise: 1750000n,
          platformFeePaise: 262500n,
          gstAmountPaise: 47250n,
          totalChargedPaise: 2059750n,
          status: CAMPAIGN_STATUS.LIVE,
          printMaterial: PRINT_MATERIALS.VINYL_STICKER,
          printSize: '24" x 12"',
          posterFileId,
          installApprover: INSTALL_APPROVERS.PLATFORM,
        },
      });
      campaignId = campaign.id;
      expect(campaignId).toBeDefined();
    });

    it('2. Driver selects campaign -> status RESERVED for 48 hours', async () => {
      const idempotencyKey = `idem-sel-${Date.now()}`;

      const res = await request(app)
        .post(`/api/v1/driver/campaigns/${campaignId}/select`)
        .set('Authorization', `Bearer ${driver1AccessToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send();

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(ASSIGNMENT_STATUS.RESERVED);
      expect(res.body.data.nextAction).toBe('START_INSTALLING');
      expect(res.body.data.expiresAt).toBeDefined();

      assignmentId = res.body.data.id;

      // Idempotency verification: same request returns existing assignment
      const repeatRes = await request(app)
        .post(`/api/v1/driver/campaigns/${campaignId}/select`)
        .set('Authorization', `Bearer ${driver1AccessToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send();

      expect(repeatRes.status).toBe(201);
      expect(repeatRes.body.data.id).toBe(assignmentId);
    });

    it('3. Driver fetches print guide and poster download URL', async () => {
      const guideRes = await request(app)
        .get(`/api/v1/driver/assignments/${assignmentId}/print-guide`)
        .set('Authorization', `Bearer ${driver1AccessToken}`);

      expect(guideRes.status).toBe(200);
      expect(guideRes.body.data.material).toBe(PRINT_MATERIALS.VINYL_STICKER);
      expect(guideRes.body.data.checklist).toBeInstanceOf(Array);

      const downloadRes = await request(app)
        .get(`/api/v1/driver/assignments/${assignmentId}/poster-download`)
        .set('Authorization', `Bearer ${driver1AccessToken}`);

      expect(downloadRes.status).toBe(200);
      expect(downloadRes.body.data.downloadUrl).toBeDefined();
    });

    it('4. Driver transitions to INSTALLING', async () => {
      const res = await request(app)
        .post(`/api/v1/driver/assignments/${assignmentId}/start-installing`)
        .set('Authorization', `Bearer ${driver1AccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(ASSIGNMENT_STATUS.INSTALLING);
      expect(res.body.data.nextAction).toBe('SUBMIT_PHOTO');
    });

    it('5. Driver submits installation photo -> status INSTALL_SUBMITTED', async () => {
      // Mock storage object
      const storageKey = `installations/install-${Date.now()}.png`;
      await storageProvider.putObject(storageKey, samplePhotoBuffer, 'image/png');

      const photoUpload = await prisma.uploadedFile.create({
        data: {
          ownerUserId: driver1UserId,
          fileKey: storageKey,
          purpose: 'INSTALLATION_PHOTO',
          mimeType: 'image/png',
          sizeBytes: samplePhotoBuffer.length,
          status: 'CONFIRMED',
        },
      });
      photoUploadId = photoUpload.id;

      const res = await request(app)
        .post(`/api/v1/driver/assignments/${assignmentId}/installation`)
        .set('Authorization', `Bearer ${driver1AccessToken}`)
        .send({
          uploadedFileId: photoUploadId,
          latitude: 23.0338,
          longitude: 72.585,
          accuracyMeters: 15.5,
          capturedAt: new Date().toISOString(),
          isMockLocation: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assignment.status).toBe(ASSIGNMENT_STATUS.INSTALL_SUBMITTED);
      expect(res.body.data.assignment.installAttempts).toBe(1);
      expect(res.body.data.assignment.nextAction).toBe('WAIT_FOR_REVIEW');
    });

    it('6. Admin sees installation in review queue, claims it, and approves', async () => {
      // 1. Queue check
      const queueRes = await request(app)
        .get('/api/v1/admin/installations/review-queue')
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(queueRes.status).toBe(200);
      const items = queueRes.body.data as Array<{ assignmentId: string }>;
      expect(items.some((i) => i.assignmentId === assignmentId)).toBe(true);

      // 2. Claim
      const claimRes = await request(app)
        .post(`/api/v1/admin/installations/${assignmentId}/claim`)
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(claimRes.status).toBe(200);
      expect(claimRes.body.data.reviewClaimedById).toBe(adminUserId);

      // 3. Approve decision
      const decideRes = await request(app)
        .post(`/api/v1/admin/installations/${assignmentId}/decision`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          decision: 'APPROVED',
          note: 'Installation cleanly mounted and number plate fully readable',
        });

      expect(decideRes.status).toBe(200);
      expect(decideRes.body.data.status).toBe(ASSIGNMENT_STATUS.INSTALL_APPROVED);
      expect(decideRes.body.data.windowDays).toBeGreaterThan(0);
      expect(decideRes.body.data.nextAction).toBe('READY_TO_RUN');
    });

    it('7. Scheduled assignment start job transitions INSTALL_APPROVED -> RUNNING when campaign starts', async () => {
      // Fast-forward campaign start date to today
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { startDate: new Date() },
      });

      const started = await AssignmentJobsService.processAssignmentStart();
      expect(started).toBeGreaterThanOrEqual(1);

      const check = await prisma.assignment.findUnique({
        where: { id: assignmentId },
      });
      expect(check?.status).toBe(ASSIGNMENT_STATUS.RUNNING);
    });

    it('8. Scheduled assignment complete job transitions RUNNING -> COMPLETED when campaign completes', async () => {
      // Mark campaign as completed
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: CAMPAIGN_STATUS.COMPLETED },
      });

      const completed = await AssignmentJobsService.processAssignmentComplete();
      expect(completed).toBeGreaterThanOrEqual(1);

      const check = await prisma.assignment.findUnique({
        where: { id: assignmentId },
      });
      expect(check?.status).toBe(ASSIGNMENT_STATUS.COMPLETED);
    });
  });

  // --------------------------------------------------------------------------
  // Flow 2: Reject -> Retry -> Max Attempts Exceeded
  // --------------------------------------------------------------------------
  describe('Reject -> Retry -> Max Attempts Exceeded Workflow', () => {
    let testCampaignId: string;
    let testAssignmentId: string;

    it('creates campaign and driver 2 reserves and submits attempt 1', async () => {
      const today = todayIST();
      const campaign = await prisma.campaign.create({
        data: {
          companyId: companyUserId,
          cityId,
          title: 'Strict Review Campaign',
          targetAutoCount: 2,
          startDate: new Date(`${addDaysIST(today, 5)}T00:00:00.000Z`),
          endDate: new Date(`${addDaysIST(today, 35)}T23:59:59.999Z`),
          dailyRentPaise: 10000,
          printingAllowancePaise: 50000,
          totalBudgetPaise: 700000n,
          platformFeePaise: 105000n,
          gstAmountPaise: 18900n,
          totalChargedPaise: 823900n,
          status: CAMPAIGN_STATUS.LIVE,
          printMaterial: PRINT_MATERIALS.VINYL_STICKER,
          posterFileId,
        },
      });
      testCampaignId = campaign.id;

      const selRes = await request(app)
        .post(`/api/v1/driver/campaigns/${testCampaignId}/select`)
        .set('Authorization', `Bearer ${driver2AccessToken}`);
      testAssignmentId = selRes.body.data.id;

      await request(app)
        .post(`/api/v1/driver/assignments/${testAssignmentId}/start-installing`)
        .set('Authorization', `Bearer ${driver2AccessToken}`);

      const storageKey = `installations/attempt1-${Date.now()}.png`;
      await storageProvider.putObject(storageKey, samplePhotoBuffer, 'image/png');
      const upload1 = await prisma.uploadedFile.create({
        data: {
          ownerUserId: driver2UserId,
          fileKey: storageKey,
          purpose: 'INSTALLATION_PHOTO',
          mimeType: 'image/png',
          sizeBytes: samplePhotoBuffer.length,
          status: 'CONFIRMED',
        },
      });

      await request(app)
        .post(`/api/v1/driver/assignments/${testAssignmentId}/installation`)
        .set('Authorization', `Bearer ${driver2AccessToken}`)
        .send({
          uploadedFileId: upload1.id,
          latitude: 23.0338,
          longitude: 72.585,
          accuracyMeters: 10,
          capturedAt: new Date().toISOString(),
        });
    });

    it('admin rejects attempt 1 with reason codes -> status INSTALL_REJECTED', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/installations/${testAssignmentId}/decision`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          decision: 'REJECTED',
          reasons: [
            { code: INSTALL_REJECT_REASONS.POSTER_WRINKLED_OR_DAMAGED, note: 'Significant wrinkles on bottom corner' },
            { code: INSTALL_REJECT_REASONS.NUMBER_PLATE_OBSCURED },
          ],
          note: 'Please re-paste without covering number plate and re-submit photo',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(ASSIGNMENT_STATUS.INSTALL_REJECTED);
      expect(res.body.data.installAttempts).toBe(1);
      expect(res.body.data.nextAction).toBe('FIX_INSTALLATION');
    });

    it('driver submits attempt 2 and admin rejects again', async () => {
      const storageKey = `installations/attempt2-${Date.now()}.png`;
      await storageProvider.putObject(storageKey, samplePhotoBuffer, 'image/png');
      const upload2 = await prisma.uploadedFile.create({
        data: {
          ownerUserId: driver2UserId,
          fileKey: storageKey,
          purpose: 'INSTALLATION_PHOTO',
          mimeType: 'image/png',
          sizeBytes: samplePhotoBuffer.length,
          status: 'CONFIRMED',
        },
      });

      await request(app)
        .post(`/api/v1/driver/assignments/${testAssignmentId}/installation`)
        .set('Authorization', `Bearer ${driver2AccessToken}`)
        .send({
          uploadedFileId: upload2.id,
          latitude: 23.0338,
          longitude: 72.585,
          accuracyMeters: 10,
          capturedAt: new Date().toISOString(),
        });

      const res = await request(app)
        .post(`/api/v1/admin/installations/${testAssignmentId}/decision`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          decision: 'REJECTED',
          reasons: [{ code: INSTALL_REJECT_REASONS.POOR_LIGHTING_OR_BLURRY }],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(ASSIGNMENT_STATUS.INSTALL_REJECTED);
      expect(res.body.data.installAttempts).toBe(2);
    });

    it('driver submits attempt 3 (final) and admin rejects -> status TERMINATED', async () => {
      const storageKey = `installations/attempt3-${Date.now()}.png`;
      await storageProvider.putObject(storageKey, samplePhotoBuffer, 'image/png');
      const upload3 = await prisma.uploadedFile.create({
        data: {
          ownerUserId: driver2UserId,
          fileKey: storageKey,
          purpose: 'INSTALLATION_PHOTO',
          mimeType: 'image/png',
          sizeBytes: samplePhotoBuffer.length,
          status: 'CONFIRMED',
        },
      });

      await request(app)
        .post(`/api/v1/driver/assignments/${testAssignmentId}/installation`)
        .set('Authorization', `Bearer ${driver2AccessToken}`)
        .send({
          uploadedFileId: upload3.id,
          latitude: 23.0338,
          longitude: 72.585,
          accuracyMeters: 10,
          capturedAt: new Date().toISOString(),
        });

      const res = await request(app)
        .post(`/api/v1/admin/installations/${testAssignmentId}/decision`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          decision: 'REJECTED',
          reasons: [{ code: INSTALL_REJECT_REASONS.WRONG_AUTO_OR_PLATE }],
          note: 'Max attempts reached',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(ASSIGNMENT_STATUS.TERMINATED);
      expect(res.body.data.installAttempts).toBe(3);
    });
  });

  // --------------------------------------------------------------------------
  // Flow 3: Voluntary Withdrawal & Slot Release
  // --------------------------------------------------------------------------
  describe('Voluntary Withdrawal & Slot Release', () => {
    let withdrawCampaignId: string;
    let withdrawAssignmentId: string;

    it('driver reserves a slot, then withdraws -> status RELEASED and slot freed', async () => {
      const today = todayIST();
      const campaign = await prisma.campaign.create({
        data: {
          companyId: companyUserId,
          cityId,
          title: 'Withdrawal Test Campaign',
          targetAutoCount: 1,
          startDate: new Date(`${addDaysIST(today, 5)}T00:00:00.000Z`),
          endDate: new Date(`${addDaysIST(today, 35)}T23:59:59.999Z`),
          dailyRentPaise: 10000,
          printingAllowancePaise: 50000,
          totalBudgetPaise: 350000n,
          platformFeePaise: 52500n,
          gstAmountPaise: 9450n,
          totalChargedPaise: 411950n,
          status: CAMPAIGN_STATUS.LIVE,
          printMaterial: PRINT_MATERIALS.VINYL_STICKER,
          posterFileId,
        },
      });
      withdrawCampaignId = campaign.id;

      const selRes = await request(app)
        .post(`/api/v1/driver/campaigns/${withdrawCampaignId}/select`)
        .set('Authorization', `Bearer ${driver1AccessToken}`);
      withdrawAssignmentId = selRes.body.data.id;

      // Withdraw
      const withdrawRes = await request(app)
        .post(`/api/v1/driver/assignments/${withdrawAssignmentId}/withdraw`)
        .set('Authorization', `Bearer ${driver1AccessToken}`)
        .send({ reason: 'Auto undergoing routine maintenance' });

      expect(withdrawRes.status).toBe(200);
      expect(withdrawRes.body.data.status).toBe(ASSIGNMENT_STATUS.RELEASED);
      expect(withdrawRes.body.data.releaseReason).toBe(ASSIGNMENT_RELEASE_REASONS.DRIVER_CANCELLED);

      // Verify poster download is now revoked
      const dlRes = await request(app)
        .get(`/api/v1/driver/assignments/${withdrawAssignmentId}/poster-download`)
        .set('Authorization', `Bearer ${driver1AccessToken}`);

      expect(dlRes.status).toBe(403);
      expect(dlRes.body.error.code).toBe(ERROR_CODES.POSTER_DOWNLOAD_REVOKED);
    });
  });

  // --------------------------------------------------------------------------
  // Flow 4: Company Review with Sanitized Driver PII & SLA Escalation
  // --------------------------------------------------------------------------
  describe('Company Review with Sanitized Driver PII & SLA Escalation', () => {
    let companyCampaignId: string;
    let companyAssignmentId: string;

    it('sets up company-reviewed campaign, driver submits photo', async () => {
      const today = todayIST();
      const campaign = await prisma.campaign.create({
        data: {
          companyId: companyUserId,
          cityId,
          title: 'Direct Company Review Campaign',
          targetAutoCount: 2,
          startDate: new Date(`${addDaysIST(today, 5)}T00:00:00.000Z`),
          endDate: new Date(`${addDaysIST(today, 35)}T23:59:59.999Z`),
          dailyRentPaise: 10000,
          printingAllowancePaise: 50000,
          totalBudgetPaise: 700000n,
          platformFeePaise: 105000n,
          gstAmountPaise: 18900n,
          totalChargedPaise: 823900n,
          status: CAMPAIGN_STATUS.LIVE,
          printMaterial: PRINT_MATERIALS.VINYL_STICKER,
          posterFileId,
          installApprover: INSTALL_APPROVERS.COMPANY,
        },
      });
      companyCampaignId = campaign.id;

      const selRes = await request(app)
        .post(`/api/v1/driver/campaigns/${companyCampaignId}/select`)
        .set('Authorization', `Bearer ${driver1AccessToken}`);
      companyAssignmentId = selRes.body.data.id;

      await request(app)
        .post(`/api/v1/driver/assignments/${companyAssignmentId}/start-installing`)
        .set('Authorization', `Bearer ${driver1AccessToken}`);

      const storageKey = `installations/comp-review-${Date.now()}.png`;
      await storageProvider.putObject(storageKey, samplePhotoBuffer, 'image/png');
      const upload = await prisma.uploadedFile.create({
        data: {
          ownerUserId: driver1UserId,
          fileKey: storageKey,
          purpose: 'INSTALLATION_PHOTO',
          mimeType: 'image/png',
          sizeBytes: samplePhotoBuffer.length,
          status: 'CONFIRMED',
        },
      });

      await request(app)
        .post(`/api/v1/driver/assignments/${companyAssignmentId}/installation`)
        .set('Authorization', `Bearer ${driver1AccessToken}`)
        .send({
          uploadedFileId: upload.id,
          latitude: 23.0338,
          longitude: 72.585,
          accuracyMeters: 10,
          capturedAt: new Date().toISOString(),
        });
    });

    it('company fetches installations list: driver identity is masked/pseudonymous', async () => {
      const res = await request(app)
        .get(`/api/v1/company/campaigns/${companyCampaignId}/installations`)
        .set('Authorization', `Bearer ${companyAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const item = res.body.data[0];
      // PII assertions: NO mobile, NO full name
      expect(item.driverMobile).toBeUndefined();
      expect(item.driverName).toBeUndefined();
      // Masked pseudonymous code and plate
      expect(item.driverCode).toMatch(/^DRV-[A-Z0-9]+$/);
      expect(item.vehiclePlateMasked).toMatch(/^\*\*\* \d{4}$/);
    });

    it('scheduled escalation job escalates overdue company reviews to PLATFORM', async () => {
      // Simulate review submission time in past (> 24 hours ago)
      const past = new Date(Date.now() - 25 * 3600 * 1000);
      await prisma.assignment.update({
        where: { id: companyAssignmentId },
        data: { installedAt: past },
      });

      const escalatedCount = await AssignmentJobsService.processInstallationEscalation();
      expect(escalatedCount).toBeGreaterThanOrEqual(1);

      const check = await prisma.assignment.findUnique({
        where: { id: companyAssignmentId },
      });
      expect(check?.reviewOwner).toBe('PLATFORM');
      expect(check?.escalatedAt).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Flow 5: Reservation Expiry Scheduled Job
  // --------------------------------------------------------------------------
  describe('Reservation Expiry Scheduled Job', () => {
    it('expires RESERVED assignments whose deadline has passed', async () => {
      const today = todayIST();
      const campaign = await prisma.campaign.create({
        data: {
          companyId: companyUserId,
          cityId,
          title: 'Expiry Test Campaign',
          targetAutoCount: 1,
          startDate: new Date(`${addDaysIST(today, 5)}T00:00:00.000Z`),
          endDate: new Date(`${addDaysIST(today, 35)}T23:59:59.999Z`),
          dailyRentPaise: 10000,
          printingAllowancePaise: 50000,
          totalBudgetPaise: 350000n,
          platformFeePaise: 52500n,
          gstAmountPaise: 9450n,
          totalChargedPaise: 411950n,
          status: CAMPAIGN_STATUS.LIVE,
          printMaterial: PRINT_MATERIALS.VINYL_STICKER,
          posterFileId,
        },
      });

      const selRes = await request(app)
        .post(`/api/v1/driver/campaigns/${campaign.id}/select`)
        .set('Authorization', `Bearer ${driver2AccessToken}`);
      const assignmentId = selRes.body.data.id;

      // Simulate past expiration
      await prisma.assignment.update({
        where: { id: assignmentId },
        data: { expiresAt: new Date(Date.now() - 3600000) },
      });

      const expiredCount = await AssignmentJobsService.processReservationExpiry();
      expect(expiredCount).toBeGreaterThanOrEqual(1);

      const check = await prisma.assignment.findUnique({
        where: { id: assignmentId },
      });
      expect(check?.status).toBe(ASSIGNMENT_STATUS.RESERVATION_EXPIRED);
      expect(check?.releaseReason).toBe(ASSIGNMENT_RELEASE_REASONS.RESERVATION_TIMEOUT);
    });
  });
});
