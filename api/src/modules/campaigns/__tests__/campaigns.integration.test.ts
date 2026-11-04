import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { prisma } from '../../../shared/db/index.js';
import { createApp } from '../../../app.js';
import {
  ROLES,
  ACCOUNT_STATUS,
  SETTING_KEYS,
  CAMPAIGN_STATUS,
  CAMPAIGN_REVIEW_REASONS,
  PRINT_MATERIALS,
  VEHICLE_TYPES,
  ASSIGNMENT_STATUS,
  ERROR_CODES,
} from '@ap/shared-constants';
import { env } from '../../../config/env.js';
import { disconnectRedis, redisClient } from '../../../shared/redis/index.js';
import { TokenService } from '../../auth/token.service.js';
import { TimeService, addDaysIST, todayIST } from '../../../shared/time/index.js';
import { CampaignJobsService } from '../../../jobs/campaign-jobs.service.js';
import { SlotsService } from '../slots.service.js';
import { AppError } from '../../../shared/errors/index.js';

describe('Phase 5: Campaigns Module Integration Test Suite (autoposter_test)', { timeout: 30000 }, () => {
  const app = createApp();

  let adminAccessToken: string;
  let companyAccessToken: string;
  let driverAccessToken: string;

  let companyUserId: string;
  let companyProfileId: string;
  let posterFileId: string;
  let cityId: string;
  let zoneId: string;

  beforeAll(async () => {
    // 1. Reset Redis
    await redisClient.flushdb();

    // 2. Clean database
    const tables = [
      'campaign_reviews',
      'assignments',
      'campaign_zones',
      'campaigns',
      'uploaded_files',
      'sessions',
      'company_profiles',
      'driver_profiles',
      'driver_zones',
      'vehicles',
      'zones',
      'cities',
      'users',
      'settings',
      'audit_logs',
    ];
    await prisma.$executeRawUnsafe(`SET session_replication_role = 'replica';`);
    for (const table of tables) {
      await prisma.$executeRawUnsafe(`DELETE FROM "${table}";`);
    }
    await prisma.$executeRawUnsafe(`SET session_replication_role = 'origin';`);

    // 3. Seed required settings
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
        { key: SETTING_KEYS.MIN_RENT_PER_30_DAYS_PAISE, value: 100000, description: 'Min rent paise' },
        { key: SETTING_KEYS.MAX_RENT_PER_30_DAYS_PAISE, value: 5000000, description: 'Max rent paise' },
        { key: SETTING_KEYS.MAX_SLOTS_PER_CAMPAIGN, value: 1000, description: 'Max slots' },
        { key: SETTING_KEYS.MIN_CAMPAIGN_DAYS, value: 7, description: 'Min duration' },
        { key: SETTING_KEYS.MAX_CAMPAIGN_DAYS, value: 90, description: 'Max duration' },
        { key: SETTING_KEYS.MIN_LEAD_DAYS, value: 3, description: 'Start lead days' },
        { key: SETTING_KEYS.DEFAULT_PRINTING_ALLOWANCE_PAISE, value: 50000, description: 'Printing allowance paise' },
        { key: SETTING_KEYS.COMMISSION_BPS, value: 1500, description: 'Platform fee bps (15%)' },
        { key: SETTING_KEYS.GST_BPS, value: 1800, description: 'GST bps (18%)' },
        { key: SETTING_KEYS.PAYMENT_DEADLINE_DAYS, value: 2, description: 'Payment deadline days' },
        { key: SETTING_KEYS.CAMPAIGN_REVIEW_SLA_HOURS, value: 24, description: 'Review SLA hours' },
      ],
    });

    // 4. Seed City & Zone
    const city = await prisma.city.create({
      data: {
        name: 'Ahmedabad',
        state: 'Gujarat',
        isActive: true,
      },
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

    // 5. Seed Users & Profiles
    // Admin
    const adminUser = await prisma.user.create({
      data: {
        email: 'moderator@autoposter.com',
        mobile: '+919876543201',
        role: ROLES.SUPER_ADMIN,
        status: ACCOUNT_STATUS.APPROVED,
        emailVerifiedAt: new Date(),
        mobileVerifiedAt: new Date(),
      },
    });
    const adminSession = await prisma.session.create({
      data: {
        userId: adminUser.id,
        tokenHash: 'dummy-admin-hash',
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    adminAccessToken = await TokenService.generateAccessToken(
      { id: adminUser.id, role: adminUser.role },
      adminSession.id,
    );

    // Company
    const companyUser = await prisma.user.create({
      data: {
        email: 'brand@campaign.com',
        mobile: '+919876543202',
        role: ROLES.COMPANY,
        status: ACCOUNT_STATUS.APPROVED,
        emailVerifiedAt: new Date(),
        mobileVerifiedAt: new Date(),
      },
    });
    companyUserId = companyUser.id;

    const companyProf = await prisma.companyProfile.create({
      data: {
        userId: companyUser.id,
        companyName: 'Acme Beverages Pvt Ltd',
        legalName: 'Acme Beverages Pvt Ltd',
        brandName: 'Acme Fizz',
        contactPersonName: 'John Doe',
        contactPersonPhone: '+919876543202',
        cityId,
        gstin: '24AAACA0000A1Z5',
      },
    });
    companyProfileId = companyProf.id;

    const compSession = await prisma.session.create({
      data: {
        userId: companyUser.id,
        tokenHash: 'dummy-company-hash',
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    companyAccessToken = await TokenService.generateAccessToken(
      { id: companyUser.id, role: companyUser.role },
      compSession.id,
    );

    const posterUpload = await prisma.uploadedFile.create({
      data: {
        ownerUserId: companyUser.id,
        fileKey: `campaigns/poster-${Date.now()}.png`,
        purpose: 'CAMPAIGN_POSTER',
        mimeType: 'image/png',
        sizeBytes: 204800,
        status: 'CONFIRMED',
      },
    });
    posterFileId = posterUpload.id;

    // Driver
    const driverUser = await prisma.user.create({
      data: {
        mobile: '+919876543203',
        role: ROLES.DRIVER,
        status: ACCOUNT_STATUS.APPROVED,
        mobileVerifiedAt: new Date(),
      },
    });

    const driverVehicle = await prisma.vehicle.create({
      data: {
        registrationNumber: 'GJ01AB1234',
        vehicleType: VEHICLE_TYPES.AUTO_RICKSHAW,
      },
    });

    const driverProf = await prisma.driverProfile.create({
      data: {
        userId: driverUser.id,
        fullName: 'Ramesh Patel',
        cityId,
        currentVehicleId: driverVehicle.id,
      },
    });

    await prisma.driverZone.create({
      data: {
        driver: { connect: { id: driverProf.id } },
        zone: { connect: { id: zoneId } },
      },
    });

    const driverSession = await prisma.session.create({
      data: {
        userId: driverUser.id,
        tokenHash: 'dummy-driver-hash',
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    driverAccessToken = await TokenService.generateAccessToken(
      { id: driverUser.id, role: driverUser.role },
      driverSession.id,
    );
  }, 30000);

  afterAll(async () => {
    await prisma.$disconnect();
    await disconnectRedis();
  }, 30000);

  // --------------------------------------------------------------------------
  // Flow 1: Full Happy Path Lifecycle
  // --------------------------------------------------------------------------
  describe('Full Happy Path Campaign Lifecycle', () => {
    let campaignId: string;
    const today = todayIST();
    const startDate = addDaysIST(today, 5); // 5 days ahead >= 3 lead days
    const endDate = addDaysIST(today, 35); // 30-day duration

    it('1. Company creates a valid campaign draft', async () => {
      const res = await request(app)
        .post('/api/v1/company/campaigns')
        .set('Authorization', `Bearer ${companyAccessToken}`)
        .send({
          title: 'Summer Launch Campaign',
          description: 'Promoting our new mango fizz drink',
          cityId,
          zoneIds: [zoneId],
          targetVehicleType: VEHICLE_TYPES.AUTO_RICKSHAW,
          slots: 10,
          startDate,
          endDate,
          rentPer30DaysPaise: 300000, // 3000 INR
          printingAllowancePaise: 50000, // 500 INR
          printMaterial: PRINT_MATERIALS.VINYL_STICKER,
          printSize: '24" x 12"',
          posterFileId,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.status).toBe(CAMPAIGN_STATUS.DRAFT);
      expect(res.body.data.slots).toBe(10);
      campaignId = res.body.data.id;
    });

    it('2. Company submits draft for admin review', async () => {
      const res = await request(app)
        .post(`/api/v1/company/campaigns/${campaignId}/submit`)
        .set('Authorization', `Bearer ${companyAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(CAMPAIGN_STATUS.SUBMITTED);
      expect(res.body.data.lastSubmittedAt).toBeDefined();
    });

    it('3. Admin sees campaign in review queue and claims it', async () => {
      // Check queue
      const queueRes = await request(app)
        .get('/api/v1/admin/campaigns/review-queue')
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(queueRes.status).toBe(200);
      expect(queueRes.body.success).toBe(true);
      const items = queueRes.body.data as Array<{ id: string }>;
      expect(items.some((item) => item.id === campaignId)).toBe(true);

      // Claim it
      const claimRes = await request(app)
        .post(`/api/v1/admin/campaigns/${campaignId}/claim`)
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(claimRes.status).toBe(200);
      expect(claimRes.body.data.status).toBe(CAMPAIGN_STATUS.UNDER_REVIEW);
      expect(claimRes.body.data.assignedToId).toBeDefined();
    });

    it('4. Admin approves campaign -> transitions to AWAITING_PAYMENT', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/campaigns/${campaignId}/decision`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          decision: 'APPROVED',
          reasons: [],
          note: 'Poster looks great and conforms to safety rules',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(CAMPAIGN_STATUS.AWAITING_PAYMENT);
      expect(res.body.data.paymentDeadlineAt).toBeDefined();
    });

    it('5. Dev payment simulation triggers payment bridge -> transitions to LIVE', async () => {
      const res = await request(app)
        .post(`/api/v1/dev/campaigns/${campaignId}/simulate-payment`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(CAMPAIGN_STATUS.LIVE);
      expect(res.body.data.liveAt).toBeDefined();
    });

    it('6. Driver can discover the LIVE campaign', async () => {
      const res = await request(app)
        .get('/api/v1/driver/campaigns')
        .set('Authorization', `Bearer ${driverAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const items = res.body.data as Array<{ id: string }>;
      expect(items.some((item) => item.id === campaignId)).toBe(true);
    });

    it('7. Scheduled campaign start job transitions LIVE -> RUNNING when startDate arrives', async () => {
      // Simulate today reaching start date
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { startDate: new Date() },
      });

      const startedCount = await CampaignJobsService.processCampaignStart();
      expect(startedCount).toBeGreaterThanOrEqual(1);

      const check = await prisma.campaign.findUnique({
        where: { id: campaignId },
      });
      expect(check?.status).toBe(CAMPAIGN_STATUS.RUNNING);
    });

    it('8. Scheduled campaign complete job transitions RUNNING -> COMPLETED when endDate passes', async () => {
      // Simulate endDate in past (shift both startDate and endDate to satisfy chk_campaigns_dates)
      const pastStart = addDaysIST(today, -35);
      const pastEnd = addDaysIST(today, -1);
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          startDate: new Date(`${pastStart}T00:00:00.000Z`),
          endDate: new Date(`${pastEnd}T00:00:00.000Z`),
        },
      });

      const completedCount = await CampaignJobsService.processCampaignComplete();
      expect(completedCount).toBeGreaterThanOrEqual(1);

      const check = await prisma.campaign.findUnique({
        where: { id: campaignId },
      });
      expect(check?.status).toBe(CAMPAIGN_STATUS.COMPLETED);
    });

  });

  // --------------------------------------------------------------------------
  // Flow 2: Reject -> Reopen -> Edit -> Resubmit
  // --------------------------------------------------------------------------
  describe('Reject -> Reopen -> Edit -> Resubmit Workflow', () => {
    let rejectedCampaignId: string;
    const today = todayIST();

    it('creates and submits a campaign to be rejected', async () => {
      const res = await request(app)
        .post('/api/v1/company/campaigns')
        .set('Authorization', `Bearer ${companyAccessToken}`)
        .send({
          title: 'Dubious Offer Campaign',
          cityId,
          slots: 5,
          startDate: addDaysIST(today, 5),
          endDate: addDaysIST(today, 35),
          rentPer30DaysPaise: 200000,
          printingAllowancePaise: 50000,
          printMaterial: PRINT_MATERIALS.VINYL_STICKER,
          posterFileId,
        });

      rejectedCampaignId = res.body.data.id;

      await request(app)
        .post(`/api/v1/company/campaigns/${rejectedCampaignId}/submit`)
        .set('Authorization', `Bearer ${companyAccessToken}`);
    });

    it('admin claims and rejects with reasons', async () => {
      await request(app)
        .post(`/api/v1/admin/campaigns/${rejectedCampaignId}/claim`)
        .set('Authorization', `Bearer ${adminAccessToken}`);

      const res = await request(app)
        .post(`/api/v1/admin/campaigns/${rejectedCampaignId}/decision`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          decision: 'REJECTED',
          reasons: [
            { code: CAMPAIGN_REVIEW_REASONS.POSTER_CONTENT_POLICY, customNote: 'Misleading discount claim' },
            { code: CAMPAIGN_REVIEW_REASONS.PRICE_TOO_LOW },
          ],
          note: 'Please update poster artwork and increase driver rent',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(CAMPAIGN_STATUS.REJECTED);
      expect(res.body.data.reviewReasons).toBeDefined();
    });

    it('company reopens the rejected campaign back to DRAFT', async () => {
      const res = await request(app)
        .post(`/api/v1/company/campaigns/${rejectedCampaignId}/reopen`)
        .set('Authorization', `Bearer ${companyAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(CAMPAIGN_STATUS.DRAFT);
    });

    it('company edits draft and resubmits', async () => {
      const editRes = await request(app)
        .put(`/api/v1/company/campaigns/${rejectedCampaignId}`)
        .set('Authorization', `Bearer ${companyAccessToken}`)
        .send({
          title: 'Corrected Verified Promo',
          rentPer30DaysPaise: 350000,
        });

      expect(editRes.status).toBe(200);
      expect(editRes.body.data.title).toBe('Corrected Verified Promo');
      expect(editRes.body.data.rentPer30DaysPaise).toBe(350010);

      const submitRes = await request(app)
        .post(`/api/v1/company/campaigns/${rejectedCampaignId}/submit`)
        .set('Authorization', `Bearer ${companyAccessToken}`);

      expect(submitRes.status).toBe(200);
      expect(submitRes.body.data.status).toBe(CAMPAIGN_STATUS.SUBMITTED);
    });
  });

  // --------------------------------------------------------------------------
  // Flow 3: Start Date Lead Validation Error
  // --------------------------------------------------------------------------
  describe('Start Date Lead Time Validation', () => {
    it('fails when start date is within minimum lead days (3 days)', async () => {
      const today = todayIST();
      const invalidStartDate = addDaysIST(today, 1); // Only 1 day ahead, fails minimum lead time

      const res = await request(app)
        .post('/api/v1/company/campaigns')
        .set('Authorization', `Bearer ${companyAccessToken}`)
        .send({
          title: 'Too Soon Campaign',
          cityId,
          slots: 5,
          startDate: invalidStartDate,
          endDate: addDaysIST(today, 30),
          rentPer30DaysPaise: 250000,
          printingAllowancePaise: 50000,
          printMaterial: PRINT_MATERIALS.VINYL_STICKER,
          posterFileId,
        });

      expect(res.status).toBe(201);
      const draftId = res.body.data.id;

      const submitRes = await request(app)
        .post(`/api/v1/company/campaigns/${draftId}/submit`)
        .set('Authorization', `Bearer ${companyAccessToken}`);

      expect(submitRes.status).toBe(400);
      expect(submitRes.body.success).toBe(false);
      expect(submitRes.body.error.code).toBe(ERROR_CODES.START_DATE_TOO_SOON);
    });
  });

  // --------------------------------------------------------------------------
  // Flow 4: Concurrency Testing on SlotsService
  // --------------------------------------------------------------------------
  describe('SlotsService Concurrency Protection (Row Locking)', () => {
    it('prevents overbooking when 20 parallel transactions race for 5 slots', async () => {
      const today = todayIST();

      // Create a campaign with exactly 5 slots
      const testCampaign = await prisma.campaign.create({
        data: {
          companyId: companyUserId,
          cityId,
          title: 'Concurrency Limited Campaign',
          targetAutoCount: 5,
          status: CAMPAIGN_STATUS.LIVE,
          startDate: new Date(),
          endDate: new Date(Date.now() + 86400000 * 30),
          dailyRentPaise: 10000,
          printingAllowancePaise: 50000,
          totalBudgetPaise: 2000000n,
          platformFeePaise: 300000n,
          gstAmountPaise: 54000n,
          totalChargedPaise: 2354000n,
          printMaterial: PRINT_MATERIALS.VINYL_STICKER,
        },
      });

      // Create 20 mock drivers & vehicles for the test
      const drivers = await Promise.all(
        Array.from({ length: 20 }, async (_, i) => {
          const user = await prisma.user.create({
            data: {
              mobile: `+9198765499${String(i).padStart(2, '0')}`,
              role: ROLES.DRIVER,
              status: ACCOUNT_STATUS.APPROVED,
            },
          });
          const vehicle = await prisma.vehicle.create({
            data: {
              registrationNumber: `GJ01CC${String(i).padStart(4, '0')}`,
              vehicleType: VEHICLE_TYPES.AUTO_RICKSHAW,
            },
          });
          const profile = await prisma.driverProfile.create({
            data: {
              userId: user.id,
              fullName: `Driver ${i}`,
              cityId,
              currentVehicleId: vehicle.id,
            },
          });
          return { user, profile, vehicle };
        }),
      );

      // Race 20 parallel attempts to reserve a slot
      const results = await Promise.allSettled(
        drivers.map(async (driver) => {
          return prisma.$transaction(
            async (tx) => {
              const usage = await SlotsService.lockCampaignForSlotChange(tx, testCampaign.id);
              if (usage.available <= 0) {
                throw new AppError(ERROR_CODES.CAMPAIGN_SLOTS_FULL, 400, 'Campaign slots are full');
              }
              return tx.assignment.create({
                data: {
                  campaignId: testCampaign.id,
                  driverId: driver.user.id,
                  vehicleId: driver.vehicle.id,
                  status: ASSIGNMENT_STATUS.RESERVED,
                  expiresAt: new Date(Date.now() + 3600000),
                  totalDays: 30,
                },
              });
            },
            { timeout: 15000 },
          );
        }),
      );

      const successes = results.filter((r) => r.status === 'fulfilled');
      const failures = results.filter((r) => r.status === 'rejected');

      expect(successes.length).toBe(5);
      expect(failures.length).toBe(15);

      // Check final slot usage
      const finalUsage = await SlotsService.getSlotUsage(testCampaign.id);
      expect(finalUsage.total).toBe(5);
      expect(finalUsage.occupied).toBe(5);
      expect(finalUsage.available).toBe(0);
    }, 30000);
  });

  // --------------------------------------------------------------------------
  // Flow 5: Payment Expiration Job
  // --------------------------------------------------------------------------
  describe('Payment Expiration Scheduled Job', () => {
    it('expires AWAITING_PAYMENT campaigns whose deadline has passed', async () => {
      const pastDeadline = new Date(Date.now() - 3600000); // 1 hour ago

      const awaitingCampaign = await prisma.campaign.create({
        data: {
          companyId: companyUserId,
          cityId,
          title: 'Expiring Campaign',
          targetAutoCount: 2,
          status: CAMPAIGN_STATUS.AWAITING_PAYMENT,
          paymentDeadlineAt: pastDeadline,
          startDate: new Date(Date.now() + 86400000 * 5),
          endDate: new Date(Date.now() + 86400000 * 35),
          dailyRentPaise: 10000,
          printingAllowancePaise: 50000,
          totalBudgetPaise: 700000n,
          platformFeePaise: 105000n,
          gstAmountPaise: 18900n,
          totalChargedPaise: 823900n,
          printMaterial: PRINT_MATERIALS.VINYL_STICKER,
        },
      });

      const expiredCount = await CampaignJobsService.processPaymentExpiry();
      expect(expiredCount).toBeGreaterThanOrEqual(1);

      const check = await prisma.campaign.findUnique({
        where: { id: awaitingCampaign.id },
      });
      expect(check?.status).toBe(CAMPAIGN_STATUS.EXPIRED);
    });
  });
});
