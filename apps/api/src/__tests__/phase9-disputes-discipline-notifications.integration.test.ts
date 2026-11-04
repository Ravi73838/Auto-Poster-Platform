import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma, disconnectPrisma } from '../shared/db/index.js';
import { AccountDirectory } from '../modules/ledger/account-directory.js';
import { CampaignPaymentService } from '../modules/payments/campaign-payment.service.js';
import { StrikeService } from '../modules/discipline/strike.service.js';
import { ReinstatementService } from '../modules/discipline/reinstatement.service.js';
import { DisputesService } from '../modules/disputes/disputes.service.js';
import { SettlementHoldProvider } from '../modules/disputes/settlement-hold.provider.js';
import { NotificationsService } from '../modules/notifications/notifications.service.js';
import {
  ROLES,
  ACCOUNT_STATUS,
  CAMPAIGN_STATUS,
  ASSIGNMENT_STATUS,
  STRIKE_STATUS,
  STRIKE_REASONS,
  STRIKE_SOURCE,
  DISPUTE_STATUS,
  DISPUTE_REASONS,
  DISPUTE_EFFECTS,
  DISPUTE_RESOLUTION_TYPES,
  DISPUTE_MESSAGE_VISIBILITY,
  NOTIFICATION_CHANNELS,
} from '@ap/shared-constants';

describe('Phase 9 Disputes, Strikes, Discipline & Notifications Integration Tests', () => {
  let driverUser: any;
  let companyUser: any;
  let adminUser: any;
  let superAdminUser: any;
  let vehicle: any;
  let campaign: any;
  let assignment: any;

  beforeAll(async () => {
    // 0. Initialize ledger accounts
    await AccountDirectory.getGatewayClearingAccount();
    await AccountDirectory.getGatewayFeesAccount();
    await AccountDirectory.getPlatformRevenueAccount();
    await AccountDirectory.getGstPayableAccount();
    await AccountDirectory.getPayoutInTransitAccount();
    await AccountDirectory.getCompanyRefundAccount();
    await AccountDirectory.getSystemAdjustmentAccount();

    // 1. Create Driver User
    driverUser = await prisma.user.create({
      data: {
        role: ROLES.DRIVER,
        mobile: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
        email: `driver_${randomUUID()}@example.com`,
        status: ACCOUNT_STATUS.APPROVED,
        preferredLanguage: 'en',
        driverProfile: {
          create: {
            fullName: 'Ramesh Patel',
            upiIdEncrypted: 'ramesh@upi',
            bankAccountNumberEncrypted: '1234567890',
            bankIfsc: 'SBIN0001234',
            bankAccountName: 'Ramesh Patel',
          },
        },
      },
    });

    // 2. Create Company User
    companyUser = await prisma.user.create({
      data: {
        role: ROLES.COMPANY,
        mobile: `+9197${Math.floor(10000000 + Math.random() * 90000000)}`,
        email: `company_${randomUUID()}@example.com`,
        status: ACCOUNT_STATUS.APPROVED,
        preferredLanguage: 'en',
        companyProfile: {
          create: {
            companyName: 'Gujarat FMCG Brands',
            gstin: `24ABCDE${Math.floor(1000 + Math.random() * 9000)}F1Z5`,
            contactPersonName: 'Alkesh Shah',
            contactPersonPhone: '+919700000000',
          },
        },
      },
    });

    // 3. Create Admin Users
    adminUser = await prisma.user.create({
      data: {
        role: ROLES.MODERATOR,
        mobile: `+9196${Math.floor(10000000 + Math.random() * 90000000)}`,
        email: `moderator_${randomUUID()}@example.com`,
        status: ACCOUNT_STATUS.APPROVED,
        preferredLanguage: 'en',
      },
    });

    superAdminUser = await prisma.user.create({
      data: {
        role: ROLES.SUPER_ADMIN,
        mobile: `+9195${Math.floor(10000000 + Math.random() * 90000000)}`,
        email: `superadmin_${randomUUID()}@example.com`,
        status: ACCOUNT_STATUS.APPROVED,
        preferredLanguage: 'en',
      },
    });

    // 4. Create Vehicle
    vehicle = await prisma.vehicle.create({
      data: {
        registrationNumber: `GJ01AB${Math.floor(1000 + Math.random() * 9000)}`,
        isVerified: true,
      },
    });

    // 5. Create Campaign in APPROVED status and fund it to establish Escrow
    const startDate = new Date();
    const endDate = new Date(Date.now() + 30 * 86400000);
    campaign = await prisma.campaign.create({
      data: {
        companyId: companyUser.id,
        title: 'Phase 9 Brand Activation',
        status: CAMPAIGN_STATUS.APPROVED,
        targetAutoCount: 5,
        startDate,
        endDate,
        dailyRentPaise: 150000, // Rs 1500
        printingAllowancePaise: 25000, // Rs 250
        platformFeePaise: 50000,
        gstAmountPaise: 9000,
        totalBudgetPaise: 1169000,
        totalChargedPaise: 1169000,
        pricingSnapshot: {
          slots: 5,
          days: 30,
          dailyRentPaise: '150000',
          printingAllowancePaise: '25000',
          rentPerSlotPaise: '150000',
          printingPerSlotPaise: '25000',
          platformFeePerSlotPaise: '10000',
          gstPerSlotPaise: '1800',
          totalPerSlotPaise: '186800',
        },
      },
    });

    // Capture payment so Escrow is fully funded with ledger entries
    const orderResult = await CampaignPaymentService.createPaymentOrder(
      campaign.id,
      companyUser.id,
      `p9-order-${randomUUID()}`,
    );
    await CampaignPaymentService.verifyPayment(
      {
        paymentId: orderResult.paymentId,
        gatewayOrderId: orderResult.gatewayOrderId,
        gatewayPaymentId: `dev_pay_${randomUUID()}`,
        gatewaySignature: 'dev_mock_signature',
      },
      companyUser.id,
    );

    // 6. Create Assignment
    assignment = await prisma.assignment.create({
      data: {
        campaignId: campaign.id,
        driverId: driverUser.id,
        vehicleId: vehicle.id,
        status: ASSIGNMENT_STATUS.RUNNING,
        expiresAt: new Date(Date.now() + 48 * 3600000),
        totalDays: 30,
      },
    });
  }, 30000);

  afterAll(async () => {
    await disconnectPrisma();
  });

  describe('1. Strike Issuance & Ladder Evaluation', () => {
    it('issues strike 1 and verifies active status', async () => {
      const strike1 = await StrikeService.issue({
        driverId: driverUser.id,
        reason: STRIKE_REASONS.FAKE_OR_OLD_PHOTO,
        source: STRIKE_SOURCE.AUTO_RULE,
        assignmentId: assignment.id,
        notes: 'Submitted duplicate image hash',
        issuedByUserId: adminUser.id,
      });

      expect(strike1.status).toBe(STRIKE_STATUS.ACTIVE);
      expect(strike1.driverId).toBe(driverUser.id);

      // Verify driver discipline summary
      const discipline = await StrikeService.getDriverDiscipline(driverUser.id);
      expect(discipline.activeStrikesCount).toBe(1);
      expect(discipline.isBanned).toBe(false);
    }, 15000);

    it('issues strike 2 and verifies meter increases without ban', async () => {
      await StrikeService.issue({
        driverId: driverUser.id,
        reason: STRIKE_REASONS.POSTER_DAMAGED_NOT_FIXED,
        source: STRIKE_SOURCE.ADMIN_MANUAL,
        assignmentId: assignment.id,
        notes: 'Poster fix notice expired after 48h',
        issuedByUserId: adminUser.id,
      });

      const discipline = await StrikeService.getDriverDiscipline(driverUser.id);
      expect(discipline.activeStrikesCount).toBe(2);
      expect(discipline.isBanned).toBe(false);
    }, 15000);

    it('issues strike 3: automatic ladder triggers 90-day ban & terminates active assignments', async () => {
      await StrikeService.issue({
        driverId: driverUser.id,
        reason: STRIKE_REASONS.POSTER_REMOVED,
        source: STRIKE_SOURCE.ADMIN_MANUAL,
        assignmentId: assignment.id,
        notes: 'Poster removed from vehicle',
        issuedByUserId: adminUser.id,
      });

      // Check driver is banned
      const discipline = await StrikeService.getDriverDiscipline(driverUser.id);
      expect(discipline.isBanned).toBe(true);
      expect(discipline.bannedUntil).toBeDefined();

      // Check assignment was automatically terminated
      const updatedAssignment = await prisma.assignment.findUnique({
        where: { id: assignment.id },
      });
      expect(updatedAssignment?.status).toBe(ASSIGNMENT_STATUS.TERMINATED);
    }, 15000);

    it('lifts ban and reinstates assignment', async () => {
      const ban = await prisma.driverBan.findFirst({
        where: { driverId: driverUser.id, liftedAt: null },
      });
      expect(ban).toBeDefined();

      await StrikeService.liftBan(ban!.id, {
        liftedBy: adminUser.id,
        reason: 'Appealed and verified genuine vehicle repair',
      });

      // Check ban lifted
      const discipline = await StrikeService.getDriverDiscipline(driverUser.id);
      expect(discipline.isBanned).toBe(false);

      // Reinstate assignment
      const reinstated = await ReinstatementService.reinstate(assignment.id, {
        reinstatedBy: adminUser.id,
        reason: 'Driver ban lifted on appeal',
      });
      expect(reinstated.status).toBe(ASSIGNMENT_STATUS.RUNNING);
    }, 15000);
  });

  describe('2. Disputes Flow & Money Hold Management', () => {
    let createdDispute: any;

    it('driver files a dispute against photo rejection; hold is placed on settlement', async () => {
      createdDispute = await DisputesService.createDriverDispute(driverUser.id, {
        assignmentId: assignment.id,
        reason: DISPUTE_REASONS.PHOTO_WRONGLY_REJECTED,
        description: 'Auto was in heavy rain, poster was fully visible despite mud splash',
        evidenceUploadedFileIds: [],
      });

      expect(createdDispute.status).toBe(DISPUTE_STATUS.OPEN);
      expect(createdDispute.heldAmountPaise).toBe(150000n); // 1 day rent held

      // Settlement hold provider should block settlement release
      const hasHolds = await SettlementHoldProvider.hasActiveHold(campaign.id);
      expect(hasHolds).toBe(true);

      const heldTotal = await SettlementHoldProvider.getHeldAmount(campaign.id);
      expect(heldTotal).toBe(150000n);
    });

    it('moderator and driver exchange messages in dispute thread', async () => {
      // Driver sends follow-up
      await DisputesService.addMessage(createdDispute.id, driverUser.id, ROLES.DRIVER, {
        body: 'Attaching another angle from morning',
      });

      // Moderator responds visible to driver
      await DisputesService.addMessage(createdDispute.id, adminUser.id, ROLES.MODERATOR, {
        body: 'Reviewing the photo integrity logs now.',
        visibleTo: DISPUTE_MESSAGE_VISIBILITY.DRIVER,
      });

      const detail = await DisputesService.getWorkspaceDetail(createdDispute.id, ROLES.MODERATOR, adminUser.id);
      expect(detail.messages.length).toBeGreaterThanOrEqual(2);
    });

    it('moderator claims dispute and previews decision', async () => {
      await DisputesService.claim(createdDispute.id, adminUser.id);

      const preview = await DisputesService.decisionPreview(createdDispute.id, {
        resolutionType: DISPUTE_RESOLUTION_TYPES.UPHELD_FOR_DRIVER,
        decisionText: 'Photo verified manually - reflection was water droplet not fraud',
        effects: [DISPUTE_EFFECTS.OVERTURN_PHOTO_REJECTION, DISPUTE_EFFECTS.RELEASE_HOLD],
        toDriverPaise: '150000',
        toCompanyPaise: '0',
      });

      expect(preview.toDriverPaise).toBe('150000');
      expect(preview.effectsSummary.length).toBeGreaterThan(0);
    });

    it('moderator executes decision, resolves dispute, and releases settlement hold', async () => {
      await DisputesService.executeDecision(createdDispute.id, adminUser.id, {
        resolutionType: DISPUTE_RESOLUTION_TYPES.UPHELD_FOR_DRIVER,
        decisionText: 'Upheld for driver. Day verified and hold released.',
        effects: [DISPUTE_EFFECTS.OVERTURN_PHOTO_REJECTION, DISPUTE_EFFECTS.RELEASE_HOLD],
        toDriverPaise: '150000',
        toCompanyPaise: '0',
      });

      const updated = await prisma.dispute.findUnique({
        where: { id: createdDispute.id },
      });
      expect(updated?.status).toBe(DISPUTE_STATUS.RESOLVED);

      // Settlement hold should now be 0
      const hasHolds = await SettlementHoldProvider.hasActiveHold(campaign.id);
      expect(hasHolds).toBe(false);
    });

    it('supports second-level review (appeal) request by driver and acceptance by Super Admin', async () => {
      // Driver requests second-level review
      await DisputesService.requestReopen(createdDispute.id, driverUser.id, {
        reason: 'Requesting review of deduction calculations by senior admin',
      });

      const afterRequest = await prisma.dispute.findUnique({
        where: { id: createdDispute.id },
      });
      expect(afterRequest?.reopenRequestedAt).toBeDefined();

      // Super Admin accepts second-level review
      const reopened = await DisputesService.acceptReopen(createdDispute.id, superAdminUser.id);
      expect(reopened.status).toBe(DISPUTE_STATUS.UNDER_REVIEW);
      expect(reopened.reviewLevel).toBe(2);
    });
  });

  describe('3. Company Dispute & Strict Privacy Protection', () => {
    it('company files dispute without seeing driver identity', async () => {
      const companyDispute = await DisputesService.createCompanyDispute(companyUser.id, {
        campaignId: campaign.id,
        reason: DISPUTE_REASONS.POSTER_MISSING,
        description: 'Auto spotted near ring road without ad flex',
        evidenceUploadedFileIds: [],
      });

      expect(companyDispute.status).toBe(DISPUTE_STATUS.OPEN);

      // Verify privacy guarantee: Company fetching dispute details sees NO driver PII
      const companyView = await DisputesService.getWorkspaceDetail(companyDispute.id, ROLES.COMPANY, companyUser.id);
      expect(companyView.id).toBe(companyDispute.id);
      // Ensure company view has no raw driver mobile or full name
      const serialized = JSON.stringify(companyView);
      expect(serialized).not.toContain('Ramesh Patel');
      expect(serialized).not.toContain(driverUser.mobile);
    });
  });

  describe('4. Notification Dispatch, In-App Delivery & Read Receipts', () => {
    it('dispatches localized in-app notification to driver', async () => {
      const result = await NotificationsService.notify({
        key: 'strike.issued',
        userId: driverUser.id,
        audienceRole: ROLES.DRIVER,
        data: {
          reason: 'Photo rejected',
          activeStrikes: 1,
          strikeLimit: 3,
        },
        channelsOverride: [NOTIFICATION_CHANNELS.IN_APP],
        forceImmediate: true,
      });

      expect(result.notificationId).toBeDefined();

      // Fetch driver notification inbox
      const inbox = await prisma.notification.findMany({
        where: { userId: driverUser.id },
        orderBy: { createdAt: 'desc' },
      });

      expect(inbox.length).toBeGreaterThan(0);
      const latest = inbox[0]!;
      expect(latest.title).toContain('Strike');
      expect(latest.readAt).toBeNull();

      // Driver marks notification as read
      await NotificationsService.markAsRead(driverUser.id, latest.id);

      const afterRead = await prisma.notification.findUnique({
        where: { id: latest.id },
      });
      expect(afterRead?.readAt).not.toBeNull();
    });
  });
});
