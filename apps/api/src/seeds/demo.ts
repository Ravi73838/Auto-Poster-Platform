import {
  ROLES,
  ACCOUNT_STATUS,
  CAMPAIGN_STATUS,
  ASSIGNMENT_STATUS,
  DAILY_PHOTO_STATUS,
  PHOTO_KINDS,
  LEDGER_REF_TYPES,
  LEDGER_DIRECTIONS,
  LEDGER_ACCOUNT_TYPES,
} from '@ap/shared-constants';
import { prisma, disconnectPrisma } from '../shared/db/index.js';
import { hashPassword, encrypt, maskUpi } from '../shared/crypto/index.js';
import { calculateCampaignPricing } from '../shared/money/index.js';
import { LedgerService } from '../modules/ledger/ledger.service.js';
import { logger } from '../shared/logger/index.js';
import { env } from '../config/env.js';
import { seedBase } from './base.js';

export async function seedDemo(): Promise<void> {
  if (env.NODE_ENV === 'production') {
    throw new Error('FATAL: Demo seed script cannot run in production environment!');
  }

  logger.info('Starting demo seed (development only)...');

  // Ensure base seeds are present first
  await seedBase();

  const defaultPassword = 'DemoPassword123!';
  const passwordHash = await hashPassword(defaultPassword);

  // 1. CITIES & ZONES
  logger.info('Seeding demo cities & zones...');
  const ahmedabad = await prisma.city.upsert({
    where: { name_state: { name: 'Ahmedabad', state: 'Gujarat' } },
    create: { name: 'Ahmedabad', state: 'Gujarat', country: 'IN', isActive: true },
    update: {},
  });

  const _surat = await prisma.city.upsert({
    where: { name_state: { name: 'Surat', state: 'Gujarat' } },
    create: { name: 'Surat', state: 'Gujarat', country: 'IN', isActive: true },
    update: {},
  });

  const _ahmedabadEast = await prisma.zone.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      cityId: ahmedabad.id,
      name: 'Ahmedabad East',
      pinCodes: ['380001', '380002', '380008'],
      centerLat: 23.0225,
      centerLng: 72.5714,
      radiusMeters: 5000,
    },
    update: {},
  });

  const ahmedabadWest = await prisma.zone.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      cityId: ahmedabad.id,
      name: 'Ahmedabad West',
      pinCodes: ['380015', '380054'],
      centerLat: 23.0338,
      centerLng: 72.5076,
      radiusMeters: 6000,
    },
    update: {},
  });

  // 2. DEMO VEHICLES
  logger.info('Seeding demo vehicles...');
  const vehicle1 = await prisma.vehicle.upsert({
    where: { registrationNumber: 'GJ-01-AB-1234' },
    create: {
      registrationNumber: 'GJ-01-AB-1234',
      ownerName: 'Rajesh Patel',
      ownerMobile: '9876543210',
      rcNumber: 'RCGJ01AB1234',
      isVerified: true,
    },
    update: {},
  });

  const _vehicle2 = await prisma.vehicle.upsert({
    where: { registrationNumber: 'GJ-01-CD-5678' },
    create: {
      registrationNumber: 'GJ-01-CD-5678',
      ownerName: 'Suresh Solanki',
      ownerMobile: '9876543211',
      rcNumber: 'RCGJ01CD5678',
      isVerified: true,
    },
    update: {},
  });

  // 3. DEMO DRIVERS
  logger.info('Seeding demo drivers...');
  const rawUpi1 = 'rajesh.auto@okicici';
  const driverUser1 = await prisma.user.upsert({
    where: { mobile: '9876543210' },
    create: {
      role: ROLES.DRIVER,
      mobile: '9876543210',
      email: 'rajesh.patel@autoposter.example',
      passwordHash,
      status: ACCOUNT_STATUS.APPROVED,
      preferredLanguage: 'gu',
    },
    update: {},
  });

  await prisma.driverProfile.upsert({
    where: { userId: driverUser1.id },
    create: {
      userId: driverUser1.id,
      currentVehicleId: vehicle1.id,
      upiIdEncrypted: encrypt(rawUpi1),
      upiIdMasked: maskUpi(rawUpi1),
      bankAccountNumberEncrypted: encrypt('123456789012'),
      bankIfsc: 'ICIC0001234',
      bankAccountName: 'Rajesh Patel',
      isAvailable: true,
      rating: 4.9,
    },
    update: {},
  });

  const driverProfile1 = await prisma.driverProfile.findUniqueOrThrow({
    where: { userId: driverUser1.id },
  });

  await prisma.driverZone.upsert({
    where: {
      driverId_zoneId: {
        driverId: driverProfile1.id,
        zoneId: ahmedabadWest.id,
      },
    },
    create: {
      driverId: driverProfile1.id,
      zoneId: ahmedabadWest.id,
    },
    update: {},
  });

  // Driver 1 Wallet Account
  const _driver1Wallet = await LedgerService.getOrCreateAccount({
    code: `USR_${driverUser1.id}_WALLET`,
    accountType: LEDGER_ACCOUNT_TYPES.DRIVER_WALLET,
    userId: driverUser1.id,
  });

  // 4. DEMO COMPANIES
  logger.info('Seeding demo companies...');
  const companyUser1 = await prisma.user.upsert({
    where: { mobile: '9123456780' },
    create: {
      role: ROLES.COMPANY,
      mobile: '9123456780',
      email: 'ads@zomato.example',
      passwordHash,
      status: ACCOUNT_STATUS.APPROVED,
      preferredLanguage: 'en',
    },
    update: {},
  });

  await prisma.companyProfile.upsert({
    where: { userId: companyUser1.id },
    create: {
      userId: companyUser1.id,
      companyName: 'Zomato Limited',
      brandName: 'Zomato',
      gstin: '24AAAAA0000A1Z5',
      contactPersonName: 'Amit Sharma',
      contactPersonPhone: '9123456780',
      isVerified: true,
    },
    update: {},
  });

  // 5. DEMO CAMPAIGN (RUNNING)
  logger.info('Seeding demo campaigns...');
  const campaignPricing = calculateCampaignPricing({
    targetAutoCount: 5,
    days: 30,
    dailyRentPaise: 10000, // 100 INR / day
    printingAllowancePaise: 50000, // 500 INR printing
    commissionRateBps: 1500, // 15%
    gstRateBps: 1800, // 18%
  });

  const runningCampaign = await prisma.campaign.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      companyId: companyUser1.id,
      title: 'Zomato Gold Foodie Rush',
      description: 'Promote Zomato Gold subscriptions across prime Ahmedabad auto routes.',
      creativeUrl: 'https://cdn.example.com/creatives/zomato-gold-poster.png',
      creativeThumbnailUrl: 'https://cdn.example.com/creatives/zomato-gold-thumb.png',
      printInstructions: 'High quality vinyl banner with UV coating 24x36 inch',
      targetAutoCount: 5,
      enrolledCount: 1,
      startDate: new Date(Date.now() - 5 * 86400000), // Started 5 days ago
      endDate: new Date(Date.now() + 25 * 86400000),
      dailyRentPaise: 10000,
      printingAllowancePaise: 50000,
      totalBudgetPaise: campaignPricing.totalBudgetPaise,
      platformFeePaise: campaignPricing.platformFeePaise,
      gstAmountPaise: campaignPricing.gstAmountPaise,
      totalChargedPaise: campaignPricing.totalChargedPaise,
      status: CAMPAIGN_STATUS.RUNNING,
      approvedAt: new Date(Date.now() - 6 * 86400000),
    },
    update: {},
  });

  await prisma.campaignZone.upsert({
    where: {
      campaignId_zoneId: {
        campaignId: runningCampaign.id,
        zoneId: ahmedabadWest.id,
      },
    },
    create: {
      campaignId: runningCampaign.id,
      zoneId: ahmedabadWest.id,
    },
    update: {},
  });

  // Campaign Escrow Ledger Account
  const campaignEscrow = await LedgerService.getOrCreateAccount({
    code: `CAM_${runningCampaign.id}_ESCROW`,
    accountType: LEDGER_ACCOUNT_TYPES.CAMPAIGN_ESCROW,
    campaignId: runningCampaign.id,
  });

  const gatewayClearing = await prisma.ledgerAccount.findUniqueOrThrow({
    where: { code: 'SYS_GATEWAY_CLEARING' },
  });

  // Seed initial ledger balance for campaign payment if not already posted
  const existingTx = await prisma.ledgerTransaction.findFirst({
    where: { refType: LEDGER_REF_TYPES.CAMPAIGN_PAYMENT, refId: runningCampaign.id },
  });

  if (!existingTx) {
    logger.info('Posting demo campaign funding ledger transaction...');
    await LedgerService.postTransaction({
      refType: LEDGER_REF_TYPES.CAMPAIGN_PAYMENT,
      refId: runningCampaign.id,
      description: `Initial funding for campaign "${runningCampaign.title}"`,
      entries: [
        {
          accountId: gatewayClearing.id,
          direction: LEDGER_DIRECTIONS.DEBIT,
          amountPaise: runningCampaign.totalChargedPaise,
        },
        {
          accountId: campaignEscrow.id,
          direction: LEDGER_DIRECTIONS.CREDIT,
          amountPaise: runningCampaign.totalChargedPaise,
        },
      ],
    });
  }

  // 6. DEMO ASSIGNMENT
  logger.info('Seeding demo assignment...');
  const assignment1 = await prisma.assignment.upsert({
    where: {
      campaignId_driverId: {
        campaignId: runningCampaign.id,
        driverId: driverUser1.id,
      },
    },
    create: {
      campaignId: runningCampaign.id,
      driverId: driverUser1.id,
      vehicleId: vehicle1.id,
      status: ASSIGNMENT_STATUS.RUNNING,
      totalDays: 30,
      verifiedDays: 3,
      missedDays: 0,
      rejectedDays: 0,
      startedAt: new Date(Date.now() - 3 * 86400000),
      expiresAt: new Date(Date.now() + 27 * 86400000),
      installedAt: new Date(Date.now() - 4 * 86400000),
      installApprovedAt: new Date(Date.now() - 3 * 86400000),
      printingAllowancePaid: true,
    },
    update: {},
  });

  // 7. DEMO PHOTOS (Installation + 2 Daily verified)
  logger.info('Seeding demo photos...');
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);

  // Installation photo
  await prisma.photo.upsert({
    where: { id: '00000000-0000-0000-0000-000000000101' },
    create: {
      id: '00000000-0000-0000-0000-000000000101',
      assignmentId: assignment1.id,
      driverId: driverUser1.id,
      kind: PHOTO_KINDS.INSTALLATION,
      photoUrl: 'https://cdn.example.com/photos/install-01.jpg',
      lat: 23.0338,
      lng: 72.5076,
      accuracyMeters: 8.5,
      capturedAt: new Date(Date.now() - 4 * 86400000),
      status: DAILY_PHOTO_STATUS.VERIFIED,
      isInsideAllowedZone: true,
    },
    update: {},
  });

  // Daily verified photo 1 (Yesterday)
  await prisma.photo.upsert({
    where: { id: '00000000-0000-0000-0000-000000000102' },
    create: {
      id: '00000000-0000-0000-0000-000000000102',
      assignmentId: assignment1.id,
      driverId: driverUser1.id,
      kind: PHOTO_KINDS.DAILY,
      photoDate: yesterday,
      photoUrl: 'https://cdn.example.com/photos/daily-01.jpg',
      lat: 23.0340,
      lng: 72.5080,
      accuracyMeters: 6.2,
      capturedAt: yesterday,
      status: DAILY_PHOTO_STATUS.VERIFIED,
      isInsideAllowedZone: true,
      distanceCoveredKm: 42.5,
    },
    update: {},
  });

  // Daily verified photo 2 (Today)
  await prisma.photo.upsert({
    where: { id: '00000000-0000-0000-0000-000000000103' },
    create: {
      id: '00000000-0000-0000-0000-000000000103',
      assignmentId: assignment1.id,
      driverId: driverUser1.id,
      kind: PHOTO_KINDS.DAILY,
      photoDate: today,
      photoUrl: 'https://cdn.example.com/photos/daily-02.jpg',
      lat: 23.0342,
      lng: 72.5082,
      accuracyMeters: 5.1,
      capturedAt: today,
      status: DAILY_PHOTO_STATUS.VERIFIED,
      isInsideAllowedZone: true,
      distanceCoveredKm: 38.0,
    },
    update: {},
  });

  logger.info('Demo seed completed successfully!');
}

// Allow direct CLI execution
if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`) {
  seedDemo()
    .catch((err) => {
      logger.error({ err }, 'Demo seed failed');
      process.exit(1);
    })
    .finally(async () => {
      await disconnectPrisma();
    });
}
