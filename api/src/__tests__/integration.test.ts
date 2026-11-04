import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient, type LedgerAccount } from '@prisma/client';
import {
  ROLES,
  ACCOUNT_STATUS,
  CAMPAIGN_STATUS,
  ASSIGNMENT_STATUS,
  DAILY_PHOTO_STATUS,
  PHOTO_KINDS,
  SETTING_KEYS,
  type SettingKey,
  LEDGER_ACCOUNT_TYPES,
  LEDGER_REF_TYPES,
  LEDGER_DIRECTIONS,
  ACTOR_TYPES,
} from '@ap/shared-constants';
import { createApp } from '../app.js';
import { SettingsService } from '../modules/settings/settings.service.js';
import { LedgerService } from '../modules/ledger/ledger.service.js';
import {
  LedgerUnbalancedError,
  InsufficientFundsError,
  SettingNotFoundError,
} from '../shared/errors/index.js';
import { disconnectRedis } from '../shared/redis/index.js';

const testDbUrl =
  process.env.DATABASE_URL_TEST ??
  'postgresql://autoposter:autoposter_local_secret@127.0.0.1:5432/autoposter_test?schema=public';

const testPrisma = new PrismaClient({
  datasources: {
    db: { url: testDbUrl },
  },
});

describe('Database & Backend Core Integration Tests (autoposter_test)', () => {
  const app = createApp();

  beforeAll(async () => {
    // Clear test tables in topological order
    await testPrisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "audit_logs",
        "ledger_entries",
        "ledger_transactions",
        "ledger_accounts",
        "photos",
        "assignments",
        "campaign_zones",
        "campaign_payments",
        "campaigns",
        "driver_zones",
        "driver_profiles",
        "company_profiles",
        "vehicles",
        "users",
        "settings",
        "zones",
        "cities"
      CASCADE;
    `);

    // Seed default settings for SettingsService testing
    await testPrisma.setting.create({
      data: {
        key: SETTING_KEYS.COMMISSION_RATE_BPS,
        value: 1500,
        description: 'Commission rate 15%',
      },
    });
  }, 30000);

  afterAll(async () => {
    await testPrisma.$disconnect();
    await disconnectRedis();
  }, 30000);

  describe('SettingsService', () => {
    it('retrieves and strongly-types a setting', async () => {
      const val = await testPrisma.setting.findUnique({
        where: { key: SETTING_KEYS.COMMISSION_RATE_BPS },
      });
      expect(val?.value).toBe(1500);
    });

    it('rejects invalid setting updates with Zod validation error', async () => {
      await expect(
        SettingsService.update(
          SETTING_KEYS.COMMISSION_RATE_BPS,
          15000, // Max is 10000 bps
          '00000000-0000-0000-0000-000000000001',
        ),
      ).rejects.toThrow();
    });

    it('throws SettingNotFoundError for non-existent setting key', async () => {
      SettingsService.clearCache();
      await expect(
        SettingsService.get('non.existent.key' as unknown as SettingKey),
      ).rejects.toThrow(SettingNotFoundError);
    });
  });

  describe('LedgerService (Double-Entry Bookkeeping)', () => {
    let clearingAcc: LedgerAccount;
    let escrowAcc: LedgerAccount;
    let walletAcc: LedgerAccount;

    beforeAll(async () => {
      clearingAcc = await testPrisma.ledgerAccount.create({
        data: {
          code: 'TEST_GATEWAY_CLEARING',
          accountType: LEDGER_ACCOUNT_TYPES.GATEWAY_CLEARING,
          currency: 'INR',
        },
      });

      escrowAcc = await testPrisma.ledgerAccount.create({
        data: {
          code: 'TEST_CAMPAIGN_ESCROW',
          accountType: LEDGER_ACCOUNT_TYPES.CAMPAIGN_ESCROW,
          currency: 'INR',
        },
      });

      walletAcc = await testPrisma.ledgerAccount.create({
        data: {
          code: 'TEST_DRIVER_WALLET',
          accountType: LEDGER_ACCOUNT_TYPES.DRIVER_WALLET,
          currency: 'INR',
        },
      });
    });

    it('posts a balanced double-entry transaction and computes snapshot balances', async () => {
      const amountPaise = 200000n; // 2000 INR

      const tx = await LedgerService.postTransaction(
        {
          refType: LEDGER_REF_TYPES.CAMPAIGN_PAYMENT,
          refId: '00000000-0000-0000-0000-000000000011',
          description: 'Company campaign payment',
          entries: [
            {
              accountId: clearingAcc.id,
              direction: LEDGER_DIRECTIONS.DEBIT,
              amountPaise,
            },
            {
              accountId: escrowAcc.id,
              direction: LEDGER_DIRECTIONS.CREDIT,
              amountPaise,
            },
          ],
        },
        testPrisma,
      );

      expect(tx.id).toBeDefined();
      expect(tx.entries).toHaveLength(2);

      const escrowEntry = tx.entries.find((e) => e.accountId === escrowAcc.id);
      expect(escrowEntry?.balanceAfterPaise).toBe(200000n);
    });

    it('rejects an unbalanced transaction with LedgerUnbalancedError', async () => {
      await expect(
        LedgerService.postTransaction(
          {
            refType: LEDGER_REF_TYPES.CAMPAIGN_PAYMENT,
            refId: '00000000-0000-0000-0000-000000000012',
            description: 'Unbalanced payment',
            entries: [
              {
                accountId: clearingAcc.id,
                direction: LEDGER_DIRECTIONS.DEBIT,
                amountPaise: 100000n,
              },
              {
                accountId: escrowAcc.id,
                direction: LEDGER_DIRECTIONS.CREDIT,
                amountPaise: 90000n, // Unbalanced by 10000 paise
              },
            ],
          },
          testPrisma,
        ),
      ).rejects.toThrow(LedgerUnbalancedError);
    });

    it('enforces overdraft protection on non-overdraft accounts (InsufficientFundsError)', async () => {
      // Driver wallet currently has 0 balance. Attempting to debit 500 INR must fail
      await expect(
        LedgerService.postTransaction(
          {
            refType: LEDGER_REF_TYPES.PAYOUT_TRANSFER,
            refId: '00000000-0000-0000-0000-000000000013',
            description: 'Payout attempt without funds',
            entries: [
              {
                accountId: walletAcc.id,
                direction: LEDGER_DIRECTIONS.DEBIT, // Decreases driver wallet
                amountPaise: 50000n,
              },
              {
                accountId: clearingAcc.id,
                direction: LEDGER_DIRECTIONS.CREDIT,
                amountPaise: 50000n,
              },
            ],
          },
          testPrisma,
        ),
      ).rejects.toThrow(InsufficientFundsError);
    });
  });

  describe('Database Raw SQL Triggers & Immutability', () => {
    it('prevents UPDATE and DELETE on ledger_transactions via append-only trigger', async () => {
      const createdTx = await testPrisma.ledgerTransaction.create({
        data: {
          refType: LEDGER_REF_TYPES.CAMPAIGN_PAYMENT,
          refId: '00000000-0000-0000-0000-000000000099',
          description: 'Immutable test transaction',
        },
      });

      // Attempting to UPDATE description must throw trigger exception
      await expect(
        testPrisma.$executeRaw`UPDATE "ledger_transactions" SET "description" = 'modified' WHERE "id" = ${createdTx.id}::uuid`,
      ).rejects.toThrow(/immutable/i);

      // Attempting to DELETE must throw trigger exception
      await expect(
        testPrisma.$executeRaw`DELETE FROM "ledger_transactions" WHERE "id" = ${createdTx.id}::uuid`,
      ).rejects.toThrow(/immutable/i);
    });

    it('prevents UPDATE and DELETE on audit_logs via append-only trigger', async () => {
      const log = await testPrisma.auditLog.create({
        data: {
          actorType: ACTOR_TYPES.SYSTEM,
          action: 'test.action',
          entityType: 'Test',
          entityId: '123',
        },
      });

      await expect(
        testPrisma.$executeRaw`UPDATE "audit_logs" SET "action" = 'hacked' WHERE "id" = ${log.id}::uuid`,
      ).rejects.toThrow(/immutable/i);

      await expect(
        testPrisma.$executeRaw`DELETE FROM "audit_logs" WHERE "id" = ${log.id}::uuid`,
      ).rejects.toThrow(/immutable/i);
    });
  });

  describe('Database Partial Unique Indexes', () => {
    it('enforces single active assignment per vehicle (uniq_active_vehicle_assignment)', async () => {
      const user = await testPrisma.user.create({
        data: {
          role: ROLES.DRIVER,
          mobile: '9898000001',
          status: ACCOUNT_STATUS.APPROVED,
        },
      });

      const company = await testPrisma.user.create({
        data: {
          role: ROLES.COMPANY,
          mobile: '9898000002',
          status: ACCOUNT_STATUS.APPROVED,
        },
      });

      const vehicle = await testPrisma.vehicle.create({
        data: {
          registrationNumber: 'GJ-01-XX-9999',
          ownerName: 'Test Owner',
          ownerMobile: '9898000001',
          rcNumber: 'RC9999',
        },
      });

      const campaign = await testPrisma.campaign.create({
        data: {
          companyId: company.id,
          title: 'Active Index Test Campaign',
          creativeUrl: 'https://example.com/art.png',
          targetAutoCount: 1,
          startDate: new Date(),
          endDate: new Date(Date.now() + 864000000),
          dailyRentPaise: 10000,
          printingAllowancePaise: 50000,
          totalBudgetPaise: 100000n,
          platformFeePaise: 15000n,
          gstAmountPaise: 2700n,
          totalChargedPaise: 117700n,
          status: CAMPAIGN_STATUS.RUNNING,
        },
      });

      // First active assignment (RUNNING)
      await testPrisma.assignment.create({
        data: {
          campaignId: campaign.id,
          driverId: user.id,
          vehicleId: vehicle.id,
          status: ASSIGNMENT_STATUS.RUNNING,
          totalDays: 10,
          expiresAt: new Date(Date.now() + 864000000),
        },
      });

      const secondDriver = await testPrisma.user.create({
        data: {
          role: ROLES.DRIVER,
          mobile: '9898000003',
          status: ACCOUNT_STATUS.APPROVED,
        },
      });

      // Attempting to create a second active assignment for the SAME vehicle must fail
      await expect(
        testPrisma.assignment.create({
          data: {
            campaignId: campaign.id,
            driverId: secondDriver.id,
            vehicleId: vehicle.id,
            status: ASSIGNMENT_STATUS.RESERVED, // Also an active status
            totalDays: 10,
            expiresAt: new Date(Date.now() + 864000000),
          },
        }),
      ).rejects.toThrow();
    });

    it('enforces one verified daily photo per assignment per photo_date', async () => {
      const driver = await testPrisma.user.findFirstOrThrow({
        where: { role: ROLES.DRIVER },
      });
      const assignment = await testPrisma.assignment.findFirstOrThrow();

      const photoDate = new Date('2026-10-29');

      // First verified daily photo for today
      await testPrisma.photo.create({
        data: {
          assignmentId: assignment.id,
          driverId: driver.id,
          kind: PHOTO_KINDS.DAILY,
          photoDate,
          photoUrl: 'https://example.com/p1.jpg',
          lat: 23.0,
          lng: 72.0,
          accuracyMeters: 5,
          capturedAt: new Date(),
          status: DAILY_PHOTO_STATUS.VERIFIED,
        },
      });

      // Attempting to insert another verified daily photo for the same date must fail
      await expect(
        testPrisma.photo.create({
          data: {
            assignmentId: assignment.id,
            driverId: driver.id,
            kind: PHOTO_KINDS.DAILY,
            photoDate,
            photoUrl: 'https://example.com/p2.jpg',
            lat: 23.0,
            lng: 72.0,
            accuracyMeters: 5,
            capturedAt: new Date(),
            status: DAILY_PHOTO_STATUS.VERIFIED,
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe('Health Readiness Endpoint', () => {
    it('GET /api/v1/health/ready returns readiness check', async () => {
      const response = await request(app).get('/api/v1/health/ready');

      expect([200, 503]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('ready');
      } else {
        expect(response.body.success).toBe(false);
      }
    });
  });
});
