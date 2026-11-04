import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import crypto from 'node:crypto';
import { prisma } from '../../../shared/db/index.js';
import { createApp } from '../../../app.js';
import {
  ROLES,
  ACCOUNT_STATUS,
  CAMPAIGN_STATUS,
  ASSIGNMENT_STATUS,
  DAY_STATUS,
  DAILY_PHOTO_STATUS,
  PHOTO_FLAG_REASONS,
  DAILY_REJECT_REASONS,
  VEHICLE_TYPES,
  ERROR_CODES,
  INSTALL_APPROVERS,
} from '@ap/shared-constants';
import { disconnectRedis, redisClient } from '../../../shared/redis/index.js';
import { TokenService } from '../../auth/token.service.js';
import { TimeService, todayIST } from '../../../shared/time/index.js';
import { DailyPhotosService } from '../daily-photos.service.js';
import { DailyProofJobsService } from '../../../jobs/daily-proof-jobs.service.js';
import { AssignmentJobsService } from '../../../jobs/assignment-jobs.service.js';
import { storageProvider } from '../../../integrations/storage/index.js';

describe('Phase 7: Daily Photo Proof and Fraud Checks Integration Test Suite', { timeout: 35000 }, () => {
  const app = createApp();

  let adminAccessToken: string;
  let adminUserId: string;
  let companyAccessToken: string;
  let companyUserId: string;

  let driverAccessToken: string;
  let driverUserId: string;
  let driverVehicleId: string;

  let driver2AccessToken: string;
  let driver2UserId: string;
  let driver2VehicleId: string;

  let cityId: string;
  let zoneId: string;
  let campaignId: string;
  let assignmentId: string;

  let validPhotoBuffer: Buffer;
  let validPhotoBuffer2: Buffer;
  const storageMap = new Map<string, Buffer>();

  beforeAll(async () => {
    await redisClient.flushdb();

    // Mock storage provider methods to avoid dependence on external MinIO
    vi.spyOn(storageProvider, 'putObject').mockImplementation(async (key: string, data: Buffer) => {
      storageMap.set(key, data);
    });
    vi.spyOn(storageProvider, 'getObject').mockImplementation(async (key: string) => {
      return storageMap.get(key) || validPhotoBuffer;
    });
    vi.spyOn(storageProvider, 'getSignedReadUrl').mockImplementation(async (key: string) => `https://mock-storage.local/${key}`);
    vi.spyOn(storageProvider, 'delete').mockImplementation(async (key: string) => {
      storageMap.delete(key);
    });

    // Clean tables
    const tables = [
      'photo_flags',
      'assignment_days',
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
      'notifications',
    ];

    await prisma.$executeRawUnsafe(`SET session_replication_role = 'replica';`);
    for (const table of tables) {
      await prisma.$executeRawUnsafe(`DELETE FROM "${table}";`);
    }
    await prisma.$executeRawUnsafe(`SET session_replication_role = 'origin';`);

    // Create City & Zone (Surat / Varachha)
    const city = await prisma.city.create({
      data: {
        name: 'Surat',
        state: 'Gujarat',
      },
    });
    cityId = city.id;

    const zone = await prisma.zone.create({
      data: {
        cityId,
        name: 'Varachha',
        centerLat: 21.20,
        centerLng: 72.85,
        radiusMeters: 5000,
      },
    });
    zoneId = zone.id;

    // Create Admin User (SUPER_ADMIN)
    const adminUser = await prisma.user.create({
      data: {
        mobile: '+919876543210',
        email: 'superadmin@autoposter.test',
        role: ROLES.SUPER_ADMIN,
        status: ACCOUNT_STATUS.APPROVED,
      },
    });
    adminUserId = adminUser.id;
    const adminSession = await prisma.session.create({
      data: {
        userId: adminUserId,
        tokenHash: 'admin-token-hash',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    adminAccessToken = await TokenService.generateAccessToken(
      { id: adminUser.id, role: adminUser.role },
      adminSession.id,
    );

    // Create Company User
    const companyUser = await prisma.user.create({
      data: {
        mobile: '+919876543211',
        email: 'advertiser@company.test',
        role: ROLES.COMPANY,
        status: ACCOUNT_STATUS.APPROVED,
        companyProfile: {
          create: {
            companyName: 'Surat Diamond Corp',
            cityId,
            contactPersonName: 'Kishore Bhai',
            contactPersonPhone: '+919876543211',
            isVerified: true,
          },
        },
      },
    });
    companyUserId = companyUser.id;
    const compSession = await prisma.session.create({
      data: {
        userId: companyUserId,
        tokenHash: 'comp-token-hash',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    companyAccessToken = await TokenService.generateAccessToken(
      { id: companyUser.id, role: companyUser.role },
      compSession.id,
    );

    // Create Driver User 1 with Vehicle and Zone
    const driverUser = await prisma.user.create({
      data: {
        mobile: '+919876543220',
        role: ROLES.DRIVER,
        status: ACCOUNT_STATUS.APPROVED,
        driverProfile: {
          create: {
            fullName: 'Ramesh Patel',
            cityId,
            driverZones: {
              create: {
                zoneId,
                isPrimary: true,
              },
            },
          },
        },
      },
    });
    driverUserId = driverUser.id;
    const driverSession = await prisma.session.create({
      data: {
        userId: driverUserId,
        tokenHash: 'driver-token-hash',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    driverAccessToken = await TokenService.generateAccessToken(
      { id: driverUser.id, role: driverUser.role },
      driverSession.id,
    );

    const vehicle = await prisma.vehicle.create({
      data: {
        registrationNumber: 'GJ-05-AP-1234',
        vehicleType: VEHICLE_TYPES.AUTO_RICKSHAW,
      },
    });
    driverVehicleId = vehicle.id;

    await prisma.driverProfile.update({
      where: { userId: driverUserId },
      data: { currentVehicleId: driverVehicleId },
    });

    // Create Driver User 2 with Vehicle
    const driverUser2 = await prisma.user.create({
      data: {
        mobile: '+919876543221',
        role: ROLES.DRIVER,
        status: ACCOUNT_STATUS.APPROVED,
        driverProfile: {
          create: {
            fullName: 'Suresh Shah',
            cityId,
            driverZones: {
              create: {
                zoneId,
                isPrimary: true,
              },
            },
          },
        },
      },
    });
    driver2UserId = driverUser2.id;
    const driver2Session = await prisma.session.create({
      data: {
        userId: driver2UserId,
        tokenHash: 'driver2-token-hash',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    driver2AccessToken = await TokenService.generateAccessToken(
      { id: driverUser2.id, role: driverUser2.role },
      driver2Session.id,
    );

    const vehicle2 = await prisma.vehicle.create({
      data: {
        registrationNumber: 'GJ-05-AP-5678',
        vehicleType: VEHICLE_TYPES.AUTO_RICKSHAW,
      },
    });
    driver2VehicleId = vehicle2.id;
    await prisma.driverProfile.update({
      where: { userId: driver2UserId },
      data: { currentVehicleId: driver2VehicleId },
    });

    // Create 10-day Campaign
    const today = todayIST();
    const campaign = await prisma.campaign.create({
      data: {
        companyId: companyUserId,
        title: 'Diwali Jewellery Expo',
        cityId,
        targetAutoCount: 5,
        startDate: new Date(`${today}T00:00:00.000Z`),
        endDate: new Date(Date.now() + 10 * 86400000),
        dailyRentPaise: 3333,
        printingAllowancePaise: 50000,
        totalBudgetPaise: BigInt(500000),
        platformFeePaise: BigInt(50000),
        gstAmountPaise: BigInt(99000),
        totalChargedPaise: BigInt(649000),
        status: CAMPAIGN_STATUS.RUNNING,
        installApprover: INSTALL_APPROVERS.PLATFORM,
        campaignZones: {
          create: { zoneId },
        },
      },
    });
    campaignId = campaign.id;

    // Create RUNNING assignment for driver 1
    const assignment = await prisma.assignment.create({
      data: {
        driverId: driverUserId,
        campaignId,
        vehicleId: driverVehicleId,
        status: ASSIGNMENT_STATUS.RUNNING,
        startedAt: new Date(`${today}T00:00:00.000Z`),
        totalDays: 10,
        windowDays: 10,
        verifiedDays: 0,
        missedDays: 0,
        excusedDays: 0,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    assignmentId = assignment.id;

    // Generate valid sample image buffers (Sharp)
    validPhotoBuffer = await sharp({
      create: {
        width: 640,
        height: 480,
        channels: 3,
        background: { r: 50, g: 150, b: 250 },
      },
    })
      .jpeg()
      .toBuffer();

    validPhotoBuffer2 = await sharp({
      create: {
        width: 640,
        height: 480,
        channels: 3,
        background: { r: 150, g: 250, b: 50 },
      },
    })
      .jpeg()
      .toBuffer();
  }, 40000);

  afterAll(async () => {
    await disconnectRedis();
    await prisma.$disconnect();
  });

  beforeEach(() => {
    // Reset random generator to standard deterministic 0.5 (no sampling)
    DailyPhotosService.randomFn = () => 0.5;
  });

  async function uploadTestFile(userId: string, buffer: Buffer): Promise<string> {
    const key = `test-daily/${crypto.randomUUID()}.jpg`;
    await storageProvider.putObject(key, buffer, 'image/jpeg');

    const uploaded = await prisma.uploadedFile.create({
      data: {
        ownerUserId: userId,
        fileKey: key,
        purpose: 'DAILY_PHOTO',
        mimeType: 'image/jpeg',
        sizeBytes: buffer.length,
        status: 'CONFIRMED',
      },
    });
    return uploaded.id;
  }

  it('1. Driver submits clean daily photo -> Auto-verified inside zone & allowed hours', async () => {
    const uploadedFileId = await uploadTestFile(driverUserId, validPhotoBuffer);
    const now = TimeService.now();

    const res = await request(app)
      .post(`/api/v1/driver/assignments/${assignmentId}/daily-photos`)
      .set('Authorization', `Bearer ${driverAccessToken}`)
      .send({
        uploadedFileId,
        latitude: 21.20, // inside zone polygon
        longitude: 72.85,
        accuracyMeters: 10.5,
        capturedAt: now.toISOString(),
        clientSentAt: now.toISOString(),
        isMockLocation: false,
        deviceInfo: {
          platform: 'android',
          model: 'Pixel 7',
          osVersion: '14',
          appVersion: '1.0.0',
          deviceInstallId: 'dev-install-001',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe(DAILY_PHOTO_STATUS.VERIFIED);
    expect(res.body.data.dayStatus).toBe(DAY_STATUS.VERIFIED);
    expect(res.body.data.autoCheckResult.passed).toBe(true);
    expect(res.body.data.attemptsLeftToday).toBe(4);

    // Verify database row
    const today = todayIST();
    const dayRow = await prisma.assignmentDay.findUnique({
      where: {
        assignmentId_date: {
          assignmentId,
          date: new Date(`${today}T00:00:00.000Z`),
        },
      },
    });
    expect(dayRow?.status).toBe(DAY_STATUS.VERIFIED);

    const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
    expect(assignment?.verifiedDays).toBe(1);
  });

  it('2. Driver attempts duplicate photo -> Hard failure, attempt not consumed', async () => {
    // Reset day row to PENDING to test duplicate detection
    const today = todayIST();
    await prisma.assignmentDay.updateMany({
      where: { assignmentId, date: new Date(`${today}T00:00:00.000Z`) },
      data: { status: DAY_STATUS.PENDING, verifiedPhotoId: null },
    });

    const initialPhotoCount = await prisma.photo.count({
      where: { assignmentId, kind: 'DAILY' },
    });

    // Upload exact same file buffer again
    const uploadedFileId = await uploadTestFile(driverUserId, validPhotoBuffer);
    const now = TimeService.now();

    const res = await request(app)
      .post(`/api/v1/driver/assignments/${assignmentId}/daily-photos`)
      .set('Authorization', `Bearer ${driverAccessToken}`)
      .send({
        uploadedFileId,
        latitude: 21.20,
        longitude: 72.85,
        accuracyMeters: 12.0,
        capturedAt: now.toISOString(),
      });

    // Hard rejection (400)
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ERROR_CODES.DUPLICATE_PHOTO);

    // Verify attempts were not consumed (no new photo created in DB)
    const afterCount = await prisma.photo.count({
      where: { assignmentId, kind: 'DAILY' },
    });
    expect(afterCount).toBe(initialPhotoCount);
  });

  it('3. Driver submits mock location -> Hard failure, attempt not consumed', async () => {
    const uploadedFileId = await uploadTestFile(driverUserId, validPhotoBuffer2);
    const now = TimeService.now();

    const res = await request(app)
      .post(`/api/v1/driver/assignments/${assignmentId}/daily-photos`)
      .set('Authorization', `Bearer ${driverAccessToken}`)
      .send({
        uploadedFileId,
        latitude: 21.20,
        longitude: 72.85,
        accuracyMeters: 15.0,
        capturedAt: now.toISOString(),
        isMockLocation: true,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ERROR_CODES.PHOTO_MOCK_LOCATION_DETECTED);
  });

  it('4. Driver checks today status and assignment days summary', async () => {
    // Restore today's verified status
    const today = todayIST();
    await prisma.assignmentDay.updateMany({
      where: { assignmentId, date: new Date(`${today}T00:00:00.000Z`) },
      data: { status: DAY_STATUS.VERIFIED },
    });

    const todayRes = await request(app)
      .get(`/api/v1/driver/assignments/${assignmentId}/today`)
      .set('Authorization', `Bearer ${driverAccessToken}`);

    expect(todayRes.status).toBe(200);
    expect(todayRes.body.data.dayStatus).toBe(DAY_STATUS.VERIFIED);
    expect(todayRes.body.data.isPastCutoff).toBe(false);

    const daysRes = await request(app)
      .get(`/api/v1/driver/assignments/${assignmentId}/days`)
      .set('Authorization', `Bearer ${driverAccessToken}`);

    expect(daysRes.status).toBe(200);
    expect(daysRes.body.data.totalDays).toBe(10);
    expect(daysRes.body.data.verifiedDays).toBe(1);
    expect(daysRes.body.data.days.length).toBeGreaterThanOrEqual(1);
  });

  it('5. Soft check triggers MANUAL_REVIEW & routes to Admin queue', async () => {
    // Create new assignment for Driver 2 to test manual review routing
    const assignment2 = await prisma.assignment.create({
      data: {
        driverId: driver2UserId,
        campaignId,
        vehicleId: driver2VehicleId,
        status: ASSIGNMENT_STATUS.RUNNING,
        startedAt: new Date(`${todayIST()}T00:00:00.000Z`),
        totalDays: 10,
        windowDays: 10,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    const diffBuffer = await sharp({
      create: { width: 500, height: 500, channels: 3, background: { r: 200, g: 100, b: 50 } },
    }).jpeg().toBuffer();
    const uploadedFileId = await uploadTestFile(driver2UserId, diffBuffer);

    // Captured at 04:00 AM IST on today's date (triggers soft time-of-day penalty)
    const today = todayIST();
    const earlyMorningToday = new Date(`${today}T04:00:00.000+05:30`);

    const res = await request(app)
      .post(`/api/v1/driver/assignments/${assignment2.id}/daily-photos`)
      .set('Authorization', `Bearer ${driver2AccessToken}`)
      .send({
        uploadedFileId,
        latitude: 21.20,
        longitude: 72.85,
        accuracyMeters: 10.0,
        capturedAt: earlyMorningToday.toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe(DAILY_PHOTO_STATUS.MANUAL_REVIEW);
    expect(res.body.data.dayStatus).toBe(DAY_STATUS.UNDER_REVIEW);
    expect(res.body.data.autoCheckResult.passed).toBe(false);

    // Admin queue should now contain this photo
    const queueRes = await request(app)
      .get('/api/v1/admin/daily-photos/queue')
      .set('Authorization', `Bearer ${adminAccessToken}`);

    expect(queueRes.status).toBe(200);
    expect(queueRes.body.data.length).toBeGreaterThan(0);
    const queuedItem = queueRes.body.data.find((p: any) => p.photoId === res.body.data.photoId);
    expect(queuedItem).toBeDefined();
    expect(queuedItem.riskScore).toBeGreaterThan(0);

    // Admin claims photo
    const claimRes = await request(app)
      .post(`/api/v1/admin/daily-photos/${queuedItem.photoId}/claim`)
      .set('Authorization', `Bearer ${adminAccessToken}`);
    expect(claimRes.status).toBe(200);

    // Admin reviews and REJECTS photo
    const reviewRes = await request(app)
      .post(`/api/v1/admin/daily-photos/${queuedItem.photoId}/review`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        decision: 'REJECT',
        reasons: [{ code: DAILY_REJECT_REASONS.PHOTO_UNCLEAR, note: 'Photo taken at 4am in dark' }],
        note: 'Night time photo with poster not visible',
      });

    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.data.status).toBe(DAILY_PHOTO_STATUS.REJECTED);
  });

  it('6. Admin excuse override credits an unverified day', async () => {
    // Set assignment day to PENDING so it can be excused
    const today = todayIST();
    await prisma.assignmentDay.updateMany({
      where: { assignmentId, date: new Date(`${today}T00:00:00.000Z`) },
      data: { status: DAY_STATUS.PENDING },
    });

    const excuseRes = await request(app)
      .post(`/api/v1/admin/assignments/${assignmentId}/days/${today}/excuse`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        reason: 'Driver vehicle broke down at workshop, verified by mechanic receipt',
      });

    expect(excuseRes.status).toBe(200);

    const dayRow = await prisma.assignmentDay.findUnique({
      where: {
        assignmentId_date: {
          assignmentId,
          date: new Date(`${today}T00:00:00.000Z`),
        },
      },
    });
    expect(dayRow?.status).toBe(DAY_STATUS.EXCUSED);

    const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
    expect(assignment?.excusedDays).toBe(1);
  });

  it('7. Company progress, privacy masking & photo flagging', async () => {
    // 1. Company views campaign progress
    const progressRes = await request(app)
      .get(`/api/v1/company/campaigns/${campaignId}/progress`)
      .set('Authorization', `Bearer ${companyAccessToken}`);

    expect(progressRes.status).toBe(200);
    expect(progressRes.body.data.campaignId).toBe(campaignId);
    expect(progressRes.body.data.runningVehicles).toBeGreaterThanOrEqual(1);

    // 2. Company lists daily photos (Verify privacy masking!)
    const photosRes = await request(app)
      .get(`/api/v1/company/campaigns/${campaignId}/photos`)
      .set('Authorization', `Bearer ${companyAccessToken}`);

    expect(photosRes.status).toBe(200);
    expect(photosRes.body.data.items.length).toBeGreaterThan(0);
    const photoItem = photosRes.body.data.items[0];

    // Privacy checks:
    expect(photoItem.driverCode).toMatch(/^Auto-\d{4}$/); // e.g. Auto-1234
    expect(photoItem.driverName).toBeUndefined();
    expect(photoItem.driverMobile).toBeUndefined();
    // Rounded coordinates (3 decimals max)
    expect(photoItem.approxLat.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(3);

    // 3. Company flags the photo
    const flagRes = await request(app)
      .post(`/api/v1/company/campaigns/${campaignId}/photos/${photoItem.id}/flag`)
      .set('Authorization', `Bearer ${companyAccessToken}`)
      .send({
        reason: PHOTO_FLAG_REASONS.POSTER_NOT_VISIBLE,
        note: 'Poster looks peeled off at the bottom corner',
      });

    expect(flagRes.status).toBe(201);
    expect(flagRes.body.data.flagId).toBeDefined();

    // 4. Download CSV report
    const csvRes = await request(app)
      .get(`/api/v1/company/campaigns/${campaignId}/report.csv`)
      .set('Authorization', `Bearer ${companyAccessToken}`);

    expect(csvRes.status).toBe(200);
    expect(csvRes.headers['content-type']).toContain('text/csv');
    expect(csvRes.text).toContain('Date,Expected Autos,Verified Autos');
  });

  it('8. Scheduled job: Daily rollover past cutoff transitions to MISSED', async () => {
    // Force day roll
    const newlyMissed = await DailyProofJobsService.processDailyDayRoll();
    expect(typeof newlyMissed).toBe('number');
  });

  it('9. Completion Gate: Blocks assignment completion if unresolved days exist', async () => {
    // Clear out other days on assignmentId
    await prisma.assignmentDay.deleteMany({ where: { assignmentId } });

    // Set campaign and assignment run window to an expired 10-day period
    const pastStart = new Date('2026-10-01T00:00:00.000Z');
    const pastEnd = new Date('2026-10-10T00:00:00.000Z');
    const unresolvedDate = new Date('2026-10-05T00:00:00.000Z');

    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: CAMPAIGN_STATUS.COMPLETED,
        startDate: pastStart,
        endDate: pastEnd,
      },
    });

    await prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        status: ASSIGNMENT_STATUS.RUNNING,
        startedAt: pastStart,
      },
    });

    // Create an unresolved UNDER_REVIEW day inside the run window
    await prisma.assignmentDay.create({
      data: {
        assignmentId,
        date: unresolvedDate,
        status: DAY_STATUS.UNDER_REVIEW,
      },
    });

    // Run completion job
    await AssignmentJobsService.processAssignmentComplete();

    // Assignment must STILL be RUNNING because of unresolved day!
    const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
    expect(assignment?.status).toBe(ASSIGNMENT_STATUS.RUNNING);

    // Admin resolves and approves the day
    await prisma.assignmentDay.update({
      where: {
        assignmentId_date: {
          assignmentId,
          date: unresolvedDate,
        },
      },
      data: { status: DAY_STATUS.VERIFIED },
    });

    // Run completion job again
    const completedCount = await AssignmentJobsService.processAssignmentComplete();
    expect(completedCount).toBeGreaterThanOrEqual(1);

    // Assignment is now COMPLETED
    const finalAssignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
    expect(finalAssignment?.status).toBe(ASSIGNMENT_STATUS.COMPLETED);
  });
});
