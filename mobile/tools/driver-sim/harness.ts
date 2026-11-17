import './bootstrap';
import type { Server } from 'node:http';
import sharp from '../../../api/node_modules/sharp';
import { ApiClient } from '../../../api/src/contract/api-client/client';
import { createApp } from '../../../api/src/app';
import { prisma as testPrisma } from '../../../api/src/shared/db/index';
import { storageProvider } from '../../../api/src/integrations/storage/index';
import type { StorageObjectMetadata } from '../../../api/src/integrations/storage/types';
import { TimeService } from '../../../api/src/shared/time/index';
import { createFakeAdapters } from '../../src/services/adapters/fakes';
import { setContainerAdapters } from '../../src/services/container';
import {
  ROLES,
  ACCOUNT_STATUS,
  CAMPAIGN_STATUS,
  FILE_PURPOSES,
  CONSENT_TYPES,
  PAYOUT_METHODS,
} from '../../../api/src/contract/constants/index';

export interface SimulatorContext {
  server: Server;
  baseUrl: string;
  client: ApiClient;
  fakes: ReturnType<typeof createFakeAdapters>;
  testPrisma: typeof testPrisma;
  adminToken: string;
  testCityId: string;
  testZoneId: string;
  testCampaignId: string;
  putMockStorage: (key: string, buffer: Buffer, mimeType?: string) => void;
  stop: () => Promise<void>;
}

/**
 * Captures row counts of key tables in the public schema to verify
 * automated simulator runs never write to, truncate, or alter public demo data.
 */
export async function snapshotPublicTableCounts(): Promise<Record<string, number>> {
  const tables = [
    'users',
    'driver_profiles',
    'campaigns',
    'assignments',
    'photos',
    'ledger_transactions',
    'ledger_entries',
  ];

  const counts: Record<string, number> = {};
  for (const table of tables) {
    try {
      const res: any = await testPrisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int as count FROM "public"."${table}"`,
      );
      counts[table] = res[0]?.count ?? 0;
    } catch {
      counts[table] = 0;
    }
  }
  return counts;
}

/**
 * Asserts that the double-entry accounting ledger is strictly balanced in the test schema.
 * Total debits must equal total credits across all posted transactions.
 */
export async function assertTestLedgerBalanced(): Promise<void> {
  const res: any = await testPrisma.$queryRawUnsafe(`
    SELECT
      COALESCE(SUM(CASE WHEN direction = 'DEBIT' THEN amount_paise ELSE 0 END), 0)::bigint as debits,
      COALESCE(SUM(CASE WHEN direction = 'CREDIT' THEN amount_paise ELSE 0 END), 0)::bigint as credits
    FROM "test"."ledger_entries"
  `);

  const debits = BigInt(res[0]?.debits || 0);
  const credits = BigInt(res[0]?.credits || 0);

  if (debits !== credits) {
    throw new Error(
      `Ledger Unbalanced! Debits (${debits} paise) != Credits (${credits} paise). Invariant broken.`,
    );
  }
}

/**
 * Boots the isolated simulator testing harness.
 * Runs on an ephemeral port against the test database schema.
 */
export async function setupSimulatorHarness(): Promise<SimulatorContext> {
  // Ensure test environment variables are active
  process.env.NODE_ENV = 'test';
  process.env.AUTH_OTP_ENABLED = 'false';
  process.env.CLOCK_CONTROL_ENABLED = 'true';

  // Configure in-memory mock storage provider
  const mockStorage = new Map<string, { buffer: Buffer; mimeType: string }>();
  let defaultJpegBuffer: Buffer | null = null;

  async function getDefaultJpeg(): Promise<Buffer> {
    if (!defaultJpegBuffer) {
      defaultJpegBuffer = await sharp({
        create: {
          width: 640,
          height: 480,
          channels: 3,
          background: { r: 120, g: 140, b: 180 },
        },
      })
        .jpeg()
        .toBuffer();
    }
    return defaultJpegBuffer;
  }

  storageProvider.getObject = async (key: string): Promise<Buffer> => {
    const item = mockStorage.get(key);
    if (item) return item.buffer;
    return getDefaultJpeg();
  };

  storageProvider.head = async (key: string): Promise<StorageObjectMetadata | null> => {
    const item = mockStorage.get(key);
    const buf = item ? item.buffer : await getDefaultJpeg();
    return {
      sizeBytes: buf.length,
      mimeType: item ? item.mimeType : 'image/jpeg',
    };
  };

  storageProvider.putObject = async (key: string, data: Buffer, mimeType: string): Promise<void> => {
    mockStorage.set(key, { buffer: data, mimeType });
  };

  storageProvider.delete = async (key: string): Promise<void> => {
    mockStorage.delete(key);
  };

  const app = createApp();

  // Start HTTP server on ephemeral port
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => {
      resolve(s);
    });
  });

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 4000;
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  let currentToken: string | null = null;
  let currentRefreshToken: string | null = null;

  // Instantiate mobile ApiClient
  const client = new ApiClient({
    baseUrl,
    getAuthToken: () => currentToken,
    setAuthToken: (t) => {
      currentToken = t;
    },
    getRefreshToken: () => currentRefreshToken,
  });

  (client as any).setTokens = (tokens: { accessToken: string | null; refreshToken?: string | null }) => {
    currentToken = tokens.accessToken;
    if (tokens.refreshToken !== undefined) {
      currentRefreshToken = tokens.refreshToken;
    }
  };

  // Inject in-memory adapters into mobile container
  const fakes = createFakeAdapters();
  setContainerAdapters(fakes);

  // Synchronize server TimeService with simulator fakes clock
  TimeService.setClock({
    now: () => fakes.clock.now(),
  });

  // Seed baseline City, Zone, Company, and Campaign in test schema
  const city = await testPrisma.city.upsert({
    where: { name_state: { name: 'Ahmedabad Simulation', state: 'Gujarat' } },
    update: {},
    create: {
      name: 'Ahmedabad Simulation',
      state: 'Gujarat',
      country: 'IN',
      isActive: true,
    },
  });

  let zone = await testPrisma.zone.findFirst({
    where: { cityId: city.id, name: 'West Zone Simulation' },
  });
  if (!zone) {
    zone = await testPrisma.zone.create({
      data: {
        cityId: city.id,
        name: 'West Zone Simulation',
        centerLat: 23.0225,
        centerLng: 72.5714,
        radiusMeters: 10000,
        isActive: true,
      },
    });
  }

  // Seed Company and poster file
  const companyUser = await testPrisma.user.upsert({
    where: { email: 'sim-advertiser@autoposter.in' },
    update: {},
    create: {
      email: 'sim-advertiser@autoposter.in',
      mobile: '+919876500001',
      role: ROLES.COMPANY,
      status: ACCOUNT_STATUS.APPROVED,
      passwordHash: '$2b$10$dummyHashForTestingPurposesOnly001',
    },
  });

  const posterFile = await testPrisma.uploadedFile.upsert({
    where: { fileKey: 'campaigns/posters/sim_poster_1.jpg' },
    update: {},
    create: {
      ownerUserId: companyUser.id,
      fileKey: 'campaigns/posters/sim_poster_1.jpg',
      purpose: FILE_PURPOSES.CAMPAIGN_POSTER,
      mimeType: 'image/jpeg',
      sizeBytes: 120000,
      status: 'CONFIRMED',
    },
  });

  const now = new Date();
  const startDate = new Date(now.getTime() - 86400 * 1000); // 1 day ago
  const endDate = new Date(now.getTime() + 29 * 86400 * 1000); // 29 days later

  let campaign = await testPrisma.campaign.findFirst({
    where: { companyId: companyUser.id, title: 'Auto Poster Driver Simulator Mega Fest' },
  });

  if (campaign) {
    campaign = await testPrisma.campaign.update({
      where: { id: campaign.id },
      data: {
        enrolledCount: 0,
        targetAutoCount: 100,
        status: CAMPAIGN_STATUS.RUNNING,
      },
    });
  } else {
    campaign = await testPrisma.campaign.create({
      data: {
        companyId: companyUser.id,
        cityId: city.id,
        posterFileId: posterFile.id,
        title: 'Auto Poster Driver Simulator Mega Fest',
        description: 'Official test campaign for mobile simulator verification',
        targetAutoCount: 100,
        enrolledCount: 0,
        startDate,
        endDate,
        dailyRentPaise: 25000, // ₹250 / day
        printingAllowancePaise: 50000, // ₹500
        totalBudgetPaise: 2000000n,
        platformFeePaise: 200000n,
        gstAmountPaise: 396000n,
        totalChargedPaise: 2596000n,
        status: CAMPAIGN_STATUS.RUNNING,
      },
    });

    await testPrisma.campaignZone.create({
      data: {
        campaignId: campaign.id,
        zoneId: zone.id,
      },
    });
  }

  // Seed Admin User for Approvals
  const adminUser = await testPrisma.user.upsert({
    where: { email: 'sim-admin@autoposter.in' },
    update: {},
    create: {
      email: 'sim-admin@autoposter.in',
      mobile: '+919999900001',
      role: ROLES.SUPER_ADMIN,
      status: ACCOUNT_STATUS.APPROVED,
      passwordHash: '$2b$10$dummyHashForTestingPurposesOnly001',
    },
  });

  const { TokenService } = await import('../../../api/src/modules/auth/token.service');
  const adminSession = await TokenService.createSession({
    userId: adminUser.id,
    platform: 'WEB',
  });

  return {
    server,
    baseUrl,
    client,
    fakes,
    testPrisma,
    adminToken: adminSession.accessToken,
    testCityId: city.id,
    testZoneId: zone.id,
    testCampaignId: campaign.id,
    putMockStorage: (key: string, buffer: Buffer, mimeType = 'image/jpeg') => {
      mockStorage.set(key, { buffer, mimeType });
    },
    stop: async () => {
      TimeService.resetClock();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    },
  };
}
