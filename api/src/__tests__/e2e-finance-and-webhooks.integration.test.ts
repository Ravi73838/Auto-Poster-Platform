import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { createApp } from '../app.js';
import { prisma } from '../shared/db/index.js';
import { TokenService } from '../modules/auth/token.service.js';
import { PasswordService } from '../modules/auth/password.service.js';
import { disconnectRedis } from '../shared/redis/index.js';
import {
  ROLES,
  CAMPAIGN_STATUS,
  PAYMENT_STATUS,
  SETTLEMENT_STATUS,
  PAYOUT_STATUS,
  REFUND_STATUS,
  ADJUSTMENT_STATUS,
  LEDGER_DIRECTIONS,
} from '@ap/shared-constants';
import { getPaymentProvider } from '../integrations/payment/index.js';
import { AccountDirectory } from '../modules/ledger/account-directory.js';

describe('Suite 5: Finance & Razorpay Webhooks Endpoints', () => {
  const app = createApp();
  let adminUserId: string;
  let secondaryAdminId: string;
  let adminToken: string;
  let companyUserId: string;
  let driverUserId: string;
  let cityId: string;
  let campaignId: string;
  let assignmentId: string;
  let paymentId: string;
  let refundId: string;
  let settlementId: string;
  let payoutId: string;
  let ledgerAccountId: string;
  let adjustmentId: string;

  beforeAll(async () => {
    // 1. Clean up relevant tables in test schema
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "webhook_events",
        "ledger_entries",
        "ledger_transactions",
        "adjustments",
        "ledger_accounts",
        "payout_batches",
        "payouts",
        "assignment_settlements",
        "refunds",
        "campaign_payments",
        "assignment_days",
        "photos",
        "assignments",
        "campaign_zones",
        "campaigns",
        "uploaded_files",
        "zones",
        "cities",
        "driver_profiles",
        "company_profiles",
        "vehicles",
        "sessions",
        "users"
      CASCADE;
    `);

    // 2. Create Super Admin
    const adminPasswordHash = await PasswordService.hash('SuperAdminStrongPass#2026!');
    const adminUser = await prisma.user.create({
      data: {
        mobile: '+919876543200',
        email: 'financeadmin@autoposter.test',
        passwordHash: adminPasswordHash,
        role: ROLES.SUPER_ADMIN,
        status: 'APPROVED',
      },
    });
    adminUserId = adminUser.id;
    const adminSession = await TokenService.createSession({ userId: adminUserId, platform: 'WEB' });
    adminToken = adminSession.accessToken;

    const secondaryAdminUser = await prisma.user.create({
      data: {
        mobile: '+919876543299',
        email: 'secondaryfinance@autoposter.test',
        passwordHash: adminPasswordHash,
        role: ROLES.FINANCE,
        status: 'APPROVED',
      },
    });
    secondaryAdminId = secondaryAdminUser.id;

    // 3. Create Company & Driver users
    const companyUser = await prisma.user.create({
      data: {
        mobile: '+919876543201',
        email: 'financecompany@autoposter.test',
        passwordHash: adminPasswordHash,
        role: ROLES.COMPANY,
        status: 'APPROVED',
      },
    });
    companyUserId = companyUser.id;

    const city = await prisma.city.create({
      data: {
        name: 'Surat Finance',
        state: 'Gujarat',
        country: 'IN',
        isActive: true,
      },
    });
    cityId = city.id;

    await prisma.companyProfile.create({
      data: {
        userId: companyUserId,
        companyName: 'Finance Test Corp',
        contactPersonName: 'Finance Manager',
        contactPersonPhone: '+919876543201',
        brandName: 'FinBrand',
        legalName: 'Finance Test Corp Ltd',
        cityId,
        isVerified: true,
      },
    });

    const driverUser = await prisma.user.create({
      data: {
        mobile: '+919876543202',
        email: 'financedriver@autoposter.test',
        passwordHash: adminPasswordHash,
        role: ROLES.DRIVER,
        status: 'APPROVED',
      },
    });
    driverUserId = driverUser.id;

    await prisma.driverProfile.create({
      data: {
        userId: driverUserId,
        cityId,
        fullName: 'Finance Test Driver',
        currentVehicleId: null,
      },
    });

    // 4. Create UploadedFile & Campaign
    const uploadedFile = await prisma.uploadedFile.create({
      data: {
        ownerUserId: companyUserId,
        fileKey: 'posters/test-finance-campaign.png',
        mimeType: 'image/png',
        sizeBytes: 10240,
        purpose: 'CAMPAIGN_POSTER',
      },
    });

    const campaign = await prisma.campaign.create({
      data: {
        companyId: companyUserId,
        cityId,
        title: 'Diwali Mega Ad 2026',
        description: 'Festival campaign for auto poster platform',
        startDate: new Date('2026-12-01'),
        endDate: new Date('2026-12-15'),
        dailyRentPaise: 50000,
        printingAllowancePaise: 20000,
        platformFeePaise: 200000n,
        gstAmountPaise: 36000n,
        totalChargedPaise: 3936000n,
        targetAutoCount: 5,
        totalBudgetPaise: 3700000n,
        posterFileId: uploadedFile.id,
        status: CAMPAIGN_STATUS.RUNNING,
      },
    });
    campaignId = campaign.id;

    // 5. Create Payment record for campaign
    const payment = await prisma.campaignPayment.create({
      data: {
        campaignId,
        companyId: companyUserId,
        amountPaise: 3700000,
        gateway: 'razorpay',
        gatewayOrderId: 'order_test_finance_001',
        gatewayPaymentId: 'pay_test_finance_001',
        status: PAYMENT_STATUS.PAID,
        method: 'UPI',
        capturedAt: new Date(),
      },
    });
    paymentId = payment.id;

    // 6. Create Refund record
    const refund = await prisma.refund.create({
      data: {
        campaignId,
        companyId: companyUserId,
        amountPaise: 50000,
        reason: 'UNFILLED_SLOTS',
        status: 'PENDING',
        requestedById: secondaryAdminId,
      },
    });
    refundId = refund.id;

    // 7. Create Vehicle & Assignment
    const vehicle = await prisma.vehicle.create({
      data: {
        registrationNumber: `GJ05FN${Math.floor(1000 + Math.random() * 9000)}`,
        vehicleType: 'AUTO_RICKSHAW',
        isVerified: true,
      },
    });

    const assignment = await prisma.assignment.create({
      data: {
        campaignId,
        driverId: driverUserId,
        vehicleId: vehicle.id,
        status: 'RUNNING',
        reservedAt: new Date('2026-12-01'),
        expiresAt: new Date('2026-12-15'),
        totalDays: 14,
      },
    });
    assignmentId = assignment.id;

    // 8. Create Settlement record
    const settlement = await prisma.assignmentSettlement.create({
      data: {
        assignmentId,
        campaignId,
        driverId: driverUserId,
        status: SETTLEMENT_STATUS.PENDING,
        totalDays: 14,
        verifiedDays: 12,
        missedDays: 2,
        payableDays: 12,
        graceDaysUsed: 0,
        dailyRentPaise: 50000n,
        rentPayablePaise: 600000n,
        printingAllowancePaise: 20000n,
        companyRefundPaise: 100000n,
        commissionPaise: 50000n,
        gstPaise: 9000n,
        totalAmountPaise: 620000n,
      },
    });
    settlementId = settlement.id;

    // 9. Create Driver Payout record (APPROVED for batch export test)
    const payout = await prisma.payout.create({
      data: {
        driverId: driverUserId,
        amountPaise: 500000n,
        method: 'UPI',
        status: PAYOUT_STATUS.APPROVED,
        payoutType: 'RENT',
        requestedAt: new Date(),
      },
    });
    payoutId = payout.id;

    // 10. Create Ledger Accounts & Double-Entry Transaction
    const escrowAcc = await prisma.ledgerAccount.create({
      data: {
        code: `CAMPAIGN_ESCROW_${campaignId}`,
        accountType: 'CAMPAIGN_ESCROW',
        currency: 'INR',
        campaignId,
      },
    });
    ledgerAccountId = escrowAcc.id;

    const platformFeeAcc = await prisma.ledgerAccount.create({
      data: {
        code: 'REV_PLATFORM_FEE',
        accountType: 'PLATFORM_REVENUE',
        currency: 'INR',
      },
    });

    // Seed balanced ledger transaction
    const tx = await prisma.ledgerTransaction.create({
      data: {
        refType: 'CAMPAIGN_PAYMENT',
        refId: paymentId,
        description: 'Campaign escrow funding',
        postedAt: new Date(),
      },
    });

    await prisma.ledgerEntry.createMany({
      data: [
        {
          transactionId: tx.id,
          accountId: escrowAcc.id,
          direction: LEDGER_DIRECTIONS.DEBIT,
          amountPaise: 3700000,
          balanceAfterPaise: 3700000,
        },
        {
          transactionId: tx.id,
          accountId: platformFeeAcc.id,
          direction: LEDGER_DIRECTIONS.CREDIT,
          amountPaise: 3700000,
          balanceAfterPaise: 3700000,
        },
      ],
    });

    // 10b. Seed Transit & Clearing accounts with funds for payout testing
    const transitAcc = await AccountDirectory.getPayoutInTransitAccount();
    const clearingAcc = await AccountDirectory.getGatewayClearingAccount();
    const transitSeedTx = await prisma.ledgerTransaction.create({
      data: {
        refType: 'CAMPAIGN_PAYMENT',
        refId: paymentId,
        description: 'Transit pre-fund for test suite',
        postedAt: new Date(),
      },
    });
    await prisma.ledgerEntry.createMany({
      data: [
        {
          transactionId: transitSeedTx.id,
          accountId: clearingAcc.id,
          direction: LEDGER_DIRECTIONS.DEBIT,
          amountPaise: 1000000n,
          balanceAfterPaise: 1000000n,
        },
        {
          transactionId: transitSeedTx.id,
          accountId: transitAcc.id,
          direction: LEDGER_DIRECTIONS.CREDIT,
          amountPaise: 1000000n,
          balanceAfterPaise: 1000000n,
        },
      ],
    });

    // 11. Create Adjustment record
    const adj = await prisma.adjustment.create({
      data: {
        accountId: escrowAcc.id,
        amountPaise: 10000n,
        direction: LEDGER_DIRECTIONS.CREDIT,
        reason: 'Fee adjustment correction',
        status: ADJUSTMENT_STATUS.PENDING,
        requestedById: secondaryAdminId,
      },
    });
    adjustmentId = adj.id;
  }, 60000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await disconnectRedis();
    await prisma.$disconnect();
  });

  // ===========================================================================
  // 1. RAZORPAY WEBHOOKS FLOW
  // ===========================================================================
  describe('1. Razorpay Webhooks Processing', () => {
    it('POST /api/v1/webhooks/razorpay rejects request with invalid signature (400)', async () => {
      const res = await request(app)
        .post('/api/v1/webhooks/razorpay')
        .set('x-razorpay-signature', 'invalid_bogus_signature')
        .send({
          event: 'payment.captured',
          payload: { payment: { entity: { id: 'pay_999' } } },
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/v1/webhooks/razorpay processes payment.captured successfully', async () => {
      // Mock payment provider verifyWebhookSignature to return true
      const provider = getPaymentProvider('razorpay');
      vi.spyOn(provider, 'verifyWebhookSignature').mockReturnValue(true);

      const eventPayload = {
        id: `evt_test_${Date.now()}`,
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_webhook_verified_001',
              order_id: 'order_test_finance_001',
              amount: 3700000,
              status: 'captured',
            },
          },
        },
      };

      const res = await request(app)
        .post('/api/v1/webhooks/razorpay')
        .set('x-razorpay-signature', 'mocked_valid_sig')
        .send(eventPayload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('processed');

      // Check webhookEvent logged
      const recorded = await prisma.webhookEvent.findFirst({
        where: { eventId: eventPayload.id },
      });
      expect(recorded).not.toBeNull();
      expect(recorded?.processedAt).toBeDefined();
    });

    it('POST /api/v1/webhooks/razorpay handles duplicate event idempotently', async () => {
      const provider = getPaymentProvider('razorpay');
      vi.spyOn(provider, 'verifyWebhookSignature').mockReturnValue(true);

      const eventPayload = {
        id: 'evt_duplicate_idempotent_001',
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_duplicate_001',
              order_id: 'order_test_finance_001',
              amount: 3700000,
              status: 'captured',
            },
          },
        },
      };

      // First run
      const res1 = await request(app)
        .post('/api/v1/webhooks/razorpay')
        .set('x-razorpay-signature', 'mocked_valid_sig')
        .send(eventPayload);

      expect(res1.status).toBe(200);

      // Duplicate run
      const res2 = await request(app)
        .post('/api/v1/webhooks/razorpay')
        .set('x-razorpay-signature', 'mocked_valid_sig')
        .send(eventPayload);

      expect(res2.status).toBe(200);
      expect(res2.body.status).toBe('already_processed');
    });
  });

  // ===========================================================================
  // 2. ADMIN FINANCE DASHBOARD & PAUSE CONTROLS
  // ===========================================================================
  describe('2. Admin Finance Dashboard & Controls', () => {
    it('GET /api/v1/admin/finance/dashboard returns financial metrics and escrow totals', async () => {
      const res = await request(app)
        .get('/api/v1/admin/finance/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('POST /api/v1/admin/finance/pause toggles finance pause state with step-up verification', async () => {
      // Step-up verification first
      await request(app)
        .post('/api/v1/admin/step-up/verify')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ password: 'SuperAdminStrongPass#2026!' });

      const res = await request(app)
        .post('/api/v1/admin/finance/pause')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          payoutsEnabled: false,
          paymentsEnabled: false,
          reason: 'Scheduled maintenance for banking partner',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.payoutsEnabled).toBe(false);
    });
  });

  // ===========================================================================
  // 3. PAYMENTS & REFUNDS
  // ===========================================================================
  describe('3. Payments & Refunds Management', () => {
    it('GET /api/v1/admin/finance/payments lists campaign payments with pagination', async () => {
      const res = await request(app)
        .get('/api/v1/admin/finance/payments')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.meta).toBeDefined();
    });

    it('GET /api/v1/admin/finance/refunds lists refunds with pagination', async () => {
      const res = await request(app)
        .get('/api/v1/admin/finance/refunds')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('POST /api/v1/admin/finance/refunds requests a campaign refund', async () => {
      const res = await request(app)
        .post('/api/v1/admin/finance/refunds')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          campaignId,
          amountPaise: '25000',
          reason: 'UNFILLED_SLOTS',
          notes: 'Customer support agreed refund',
          idempotencyKey: `ref_key_${Date.now()}`,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amountPaise).toBe('25000');
    });

    it('POST /api/v1/admin/finance/refunds/:id/review approves a pending refund', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/finance/refunds/${refundId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          decision: 'APPROVED',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.refund.status).toBe(REFUND_STATUS.SUCCEEDED);
    });
  });

  // ===========================================================================
  // 4. SETTLEMENTS & CAMPAIGN CLOSEOUT
  // ===========================================================================
  describe('4. Settlements & Campaign Closeout', () => {
    it('GET /api/v1/admin/finance/settlements lists driver assignment settlements', async () => {
      const res = await request(app)
        .get('/api/v1/admin/finance/settlements')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('POST /api/v1/admin/finance/settlements/:id/review approves settlement', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/finance/settlements/${settlementId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          decision: 'APPROVE',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PAID');
    });

    it('POST /api/v1/admin/finance/campaigns/:id/closeout closes out completed campaign', async () => {
      // Set campaign to COMPLETED status and assignment to PAID before closeout
      await prisma.assignment.update({
        where: { id: assignmentId },
        data: { status: 'PAID' },
      });

      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: CAMPAIGN_STATUS.COMPLETED },
      });

      const res = await request(app)
        .post(`/api/v1/admin/finance/campaigns/${campaignId}/closeout`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ===========================================================================
  // 5. PAYOUTS MANAGEMENT
  // ===========================================================================
  describe('5. Payouts Management', () => {
    it('GET /api/v1/admin/finance/payouts lists driver payouts', async () => {
      const res = await request(app)
        .get('/api/v1/admin/finance/payouts')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('POST /api/v1/admin/finance/payouts/export-csv exports banking payout batch CSV', async () => {
      const res = await request(app)
        .post('/api/v1/admin/finance/payouts/export-csv')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toContain('text/csv');
      expect(res.text).toBeDefined();
    });

    it('POST /api/v1/admin/finance/payouts/import-csv processes bank statement reconciliation', async () => {
      // Mock CSV bank response content with snake_case headers
      const csvContent = [
        'payout_id,status,utr,failure_reason',
        `${payoutId},PAID,UTR9988776655,`,
      ].join('\n');

      const res = await request(app)
        .post('/api/v1/admin/finance/payouts/import-csv')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ csv: csvContent });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ===========================================================================
  // 6. LEDGER EXPLORER, TRIAL BALANCE & ADJUSTMENTS
  // ===========================================================================
  describe('6. Ledger Explorer & Double-Entry Invariants', () => {
    it('GET /api/v1/admin/finance/ledger/accounts lists ledger accounts with real-time balance', async () => {
      const res = await request(app)
        .get('/api/v1/admin/finance/ledger/accounts')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/v1/admin/finance/ledger/transactions lists ledger transactions with journal entries', async () => {
      const res = await request(app)
        .get('/api/v1/admin/finance/ledger/transactions')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/v1/admin/finance/ledger/trial-balance verifies zero sum invariant across ledger', async () => {
      const res = await request(app)
        .get('/api/v1/admin/finance/ledger/trial-balance')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isBalanced).toBe(true);
      expect(res.body.data.diffPaise).toBe('0');
    });

    it('GET /api/v1/admin/finance/adjustments lists adjustments', async () => {
      const res = await request(app)
        .get('/api/v1/admin/finance/adjustments')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /api/v1/admin/finance/adjustments creates an adjustment request', async () => {
      const res = await request(app)
        .post('/api/v1/admin/finance/adjustments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          accountId: ledgerAccountId,
          amountPaise: '5000',
          direction: LEDGER_DIRECTIONS.DEBIT,
          reason: 'Manual adjustment for fee reversal',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amountPaise).toBe('5000');
    });

    it('POST /api/v1/admin/finance/adjustments/:id/review approves adjustment with step-up verification', async () => {
      // Step up verification
      await request(app)
        .post('/api/v1/admin/step-up/verify')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ password: 'SuperAdminStrongPass#2026!' });

      const res = await request(app)
        .post(`/api/v1/admin/finance/adjustments/${adjustmentId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          decision: 'APPROVED',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('EXECUTED');
    });
  });
});
